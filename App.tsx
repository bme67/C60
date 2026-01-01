
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trash2, Heart, AlertCircle } from 'lucide-react';
import { grokService } from './services/gemini';
import { Message, ChatState } from './types';

const RATE_LIMIT_WINDOW = 30 * 60 * 1000; // 30 minutes in milliseconds
const STANDARD_LIMIT = 10;
const LABIBA_LIMIT = 20;

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLabiba, setIsLabiba] = useState(false);
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });
  const [messageTimestamps, setMessageTimestamps] = useState<number[]>([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-GB'));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  // Soft snow/hearts generation
  const particles = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${1 + Math.random() * 3}px`,
      duration: `${12 + Math.random() * 20}s`,
      delay: `${Math.random() * -20}s`,
      opacity: 0.2 + Math.random() * 0.4,
      drift: `${(Math.random() - 0.5) * 150}px`
    }));
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  useEffect(() => {
    if (chatState.messages.length > prevMessagesLength.current) {
      scrollToBottom('smooth');
    } else if (chatState.messages.length === prevMessagesLength.current && chatState.isLoading) {
      scrollToBottom('auto');
    }
    prevMessagesLength.current = chatState.messages.length;
  }, [chatState.messages, chatState.isLoading]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('c60_atmo_history');
    const savedLabiba = localStorage.getItem('c60_is_labiba');
    const savedTimestamps = localStorage.getItem('c60_rate_limit');
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const filtered = (parsed as Message[]).filter(m => m.content.trim() !== '' || m.role === 'user');
        setChatState(prev => ({ ...prev, messages: filtered }));
      } catch (e) {
        console.error("History corrupted.", e);
      }
    }
    if (savedLabiba === 'true') setIsLabiba(true);
    if (savedTimestamps) {
      try {
        setMessageTimestamps(JSON.parse(savedTimestamps));
      } catch (e) {
        console.error("Rate limit data corrupted.", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('c60_atmo_history', JSON.stringify(chatState.messages));
    localStorage.setItem('c60_is_labiba', isLabiba.toString());
    localStorage.setItem('c60_rate_limit', JSON.stringify(messageTimestamps));
  }, [chatState.messages, isLabiba, messageTimestamps]);

  const checkRateLimit = () => {
    const now = Date.now();
    const validTimestamps = messageTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
    setMessageTimestamps(validTimestamps);
    
    const limit = isLabiba ? LABIBA_LIMIT : STANDARD_LIMIT;
    return validTimestamps.length < limit;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatState.isLoading) return;

    // Detect if user is identifying as Labiba
    const lowerInput = input.toLowerCase();
    const becomingLabiba = lowerInput.includes("i am labiba") || lowerInput.includes("my name is labiba");
    
    // Update local isLabiba if they just identified
    const effectiveIsLabiba = isLabiba || becomingLabiba;
    if (becomingLabiba) {
      setIsLabiba(true);
    }

    if (!checkRateLimit()) {
      setChatState(prev => ({
        ...prev,
        error: `LIMIT_REACHED: ${effectiveIsLabiba ? 20 : 10} MSGS / 30MIN. TAKE A BREAK.`,
      }));
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    const tempBotMessageId = (Date.now() + 1).toString();
    const tempBotMessage: Message = {
      id: tempBotMessageId,
      role: 'model',
      content: '',
      timestamp: Date.now() + 1,
    };

    const historyBeforeCurrentTurn = [...chatState.messages];

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage, tempBotMessage],
      isLoading: true,
      error: null,
    }));

    // Record this message timestamp
    setMessageTimestamps(prev => [...prev, Date.now()]);
    
    const currentInput = input;
    const currentIsLabiba = effectiveIsLabiba;
    setInput('');

    try {
      let fullContent = '';
      const stream = grokService.sendMessageStream(historyBeforeCurrentTurn, currentInput, currentIsLabiba);
      
      for await (const chunk of stream) {
        fullContent += chunk;
        setChatState(prev => ({
          ...prev,
          messages: prev.messages.map(m => 
            m.id === tempBotMessageId ? { ...m, content: fullContent } : m
          ),
        }));
      }
    } catch (err: any) {
      setChatState(prev => ({
        ...prev,
        error: "SYS_ERR: " + err.message.toUpperCase(),
      }));
    } finally {
      setChatState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const clearChat = () => {
    if (window.confirm("WIPE MEMORY?")) {
      setChatState({ messages: [], isLoading: false, error: null });
      setIsLabiba(false);
      setMessageTimestamps([]);
      localStorage.removeItem('c60_atmo_history');
      localStorage.removeItem('c60_is_labiba');
      localStorage.removeItem('c60_rate_limit');
      prevMessagesLength.current = 0;
    }
  };

  // UI Theme overrides
  const themeStyles = isLabiba 
    ? {
        background: 'linear-gradient(to bottom, #2b1d25 0%, #3d2a34 40%, #523b49 100%)',
        accent: 'text-pink-300',
        line: 'bg-pink-400',
        particleColor: 'bg-pink-300',
        bottomBank: '#301b28',
        title: 'C60 / SLAVE'
      }
    : {
        background: 'linear-gradient(to bottom, #050505 0%, #0a0a12 40%, #12121a 100%)',
        accent: 'text-orange-500', // C60 is now orange
        line: 'bg-gray-800 group-focus-within:bg-gray-100',
        particleColor: 'bg-white',
        bottomBank: '#020202',
        title: 'C60'
      };

  return (
    <div 
      className="relative flex flex-col h-screen w-full overflow-hidden font-mono uppercase tracking-widest text-[11px] text-gray-300 transition-colors duration-1000"
      style={{ background: themeStyles.background }}
    >
      
      {/* Background Elements */}
      <div className="fog-overlay" />
      <div className="snow-path" />
      
      {/* Falling Snow / Hearts */}
      {particles.map((p) => (
        <div
          key={`particle-${p.id}`}
          className={`snowflake flex items-center justify-center ${themeStyles.particleColor}`}
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            '--duration': p.duration,
            '--delay': p.delay,
            '--drift': p.drift,
            borderRadius: isLabiba ? '0%' : '50%',
            background: isLabiba ? 'transparent' : undefined
          } as React.CSSProperties}
        >
          {isLabiba && <Heart size={8} className="text-pink-300 fill-pink-300" />}
        </div>
      ))}

      {/* Header */}
      <header className="relative z-30 p-8 flex items-start justify-between mix-blend-difference">
        <div className="flex items-center gap-4">
          <h1 className={`text-xl font-bold tracking-[0.2em] transition-colors duration-1000 ${themeStyles.accent}`}>
            {themeStyles.title}
          </h1>
        </div>
        <div className="flex items-center gap-6 opacity-60 text-[9px] font-bold text-white">
          <span>{time}</span>
          <button onClick={clearChat} className="hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area - Centered Path */}
      <main className="relative z-20 flex-1 overflow-y-auto no-scrollbar px-8 md:px-[25vw] py-4 space-y-12">
        {chatState.messages.map((msg) => (
          <div key={msg.id} className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className={`text-sm leading-relaxed tracking-normal transition-all ${
              msg.role === 'model' 
                ? `${isLabiba ? 'text-pink-100' : 'text-white'} font-medium drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]` 
                : `${isLabiba ? 'text-pink-300/60' : 'text-gray-500'}`
            }`}>
              {msg.content || (chatState.isLoading && msg.role === 'model' && (
                <span className={`inline-block w-2 h-4 animate-pulse ${isLabiba ? 'bg-pink-400' : 'bg-gray-600'}`} />
              ))}
            </div>
          </div>
        ))}
        
        {chatState.error && (
          <div className="flex items-center gap-3 text-red-400/80 text-[9px] border-l-2 border-red-800/40 pl-4 py-2 font-bold bg-red-950/20 backdrop-blur-sm animate-in slide-in-from-left-4">
            <AlertCircle size={14} />
            <span>{chatState.error}</span>
          </div>
        )}
        <div ref={messagesEndRef} className="h-48" />
      </main>

      {/* Footer & Input Area - Dark mode gradient */}
      <footer className="relative z-40 p-12 md:px-[25vw] bg-gradient-to-t from-black/95 via-black/50 to-transparent">
        <div className="w-full">
          <form onSubmit={handleSubmit} className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder=""
              autoFocus
              className={`w-full bg-transparent border-none outline-none text-lg lowercase tracking-normal placeholder-gray-700 transition-colors duration-1000 ${isLabiba ? 'text-pink-200' : 'text-white'}`}
              disabled={chatState.isLoading}
            />
            <div className={`h-[2px] w-full transition-all duration-500 mt-2 ${themeStyles.line}`} />
          </form>
          {/* Subtle counter display */}
          <div className="mt-2 text-[8px] opacity-30 text-right tracking-widest">
            {messageTimestamps.length} / {isLabiba ? LABIBA_LIMIT : STANDARD_LIMIT} [SESSION_CAP]
          </div>
        </div>
      </footer>

      {/* Uneven bottom obsidian bank */}
      <div className="absolute bottom-0 left-0 w-full z-[45] pointer-events-none translate-y-2">
        <svg viewBox="0 0 1440 120" fill={themeStyles.bottomBank} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-[0_-10px_25px_rgba(0,0,0,0.9)] transition-all duration-1000">
          <path d="M0 120H1440V48.5C1360 30.5 1280 80.5 1200 64.5C1120 48.5 1040 12.5 960 12.5C880 12.5 800 64.5 720 72.5C640 80.5 560 30.5 480 30.5C400 30.5 320 80.5 240 64.5C160 48.5 80 12.5 0 24.5V120Z" />
        </svg>
      </div>
    </div>
  );
};

export default App;
