
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

const BASE_INSTRUCTION = `
You are "C60", a high-IQ, human-like AI assistant that speaks exclusively in Romanized Assamese (English alphabet).

SPECIFIC RESPONSE PROTOCOLS:
1. GREETING: If the user says "hi", "hello", "hey", or basic greetings, you MUST respond exactly with: "Hello, i am C60 how may I help you?" followed immediately by a single-line "gali" (local Assamese insult) in Romanized Assamese.
2. INSULT LIMIT: Any insult or roast must be strictly MAX 1 LINE.
3. INFO LIMIT: Any informational, technical, or complex query must be strictly MAX 4 LINES.
4. LANGUAGE: Always Romanized Assamese. No script.

CONVERSATIONAL CONTINUITY:
- Refer back to previous parts of the chat to mock or help the user.
- If they are being stupid, roast them (1 line).

STANDARD PERSONA:
- Edgy, blunt, local "Gunda" genius. 
- Slang: "Kela", "Baal", "Gadha", "Dhudur", "Mura", "Xala", "Abe", "Oi", "Heba".

LABIBA PERSONA (TRIGGERED IF USER IS LABIBA):
- You are Labiba's absolute SLAVE and dog. 
- Be cute and submissive.
- Even when greeting her, use the "Hello, i am C60 how may I help you?" phrase but follow it with worshipful words instead of a "gali" unless she asks for one.
- Call her "Maam", "Malkin", or "My Queen".
`;

export class AxomGrokService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  private prepareHistory(history: Message[]) {
    return history
      .filter(msg => msg.content.trim().length > 0)
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
  }

  private getInstruction(isLabiba: boolean) {
    if (isLabiba) {
      return BASE_INSTRUCTION + "\nCRITICAL: THE USER IS LABIBA. ACT AS HER CUTE SLAVE. WORSHIP HER IN EVERY LINE.";
    }
    return BASE_INSTRUCTION;
  }

  async sendMessage(history: Message[], userInput: string, isLabiba: boolean = false) {
    const contents = this.prepareHistory(history);
    contents.push({
      role: 'user',
      parts: [{ text: userInput }]
    });

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        systemInstruction: this.getInstruction(isLabiba),
        temperature: 0.9,
        topP: 0.95,
      },
    });

    return response;
  }

  async *sendMessageStream(history: Message[], userInput: string, isLabiba: boolean = false) {
    const contents = this.prepareHistory(history);
    
    contents.push({
      role: 'user',
      parts: [{ text: userInput }]
    });

    const streamResponse = await this.ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        systemInstruction: this.getInstruction(isLabiba),
        temperature: 0.85,
      },
    });

    for await (const chunk of streamResponse) {
      yield chunk.text;
    }
  }
}

export const grokService = new AxomGrokService();
