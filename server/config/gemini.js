import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// gemini-1.5-flash is stable and supported - ideal for general production use.
// Switch to Vertex AI if you require enterprise-grade quotas and SLAs.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Cached client — avoids re-instantiating on every request for faster cold path.
let _genAI = null;
const getGenAI = () => {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY. Add it to the server .env file before starting the API.');
  }
  if (!_genAI) _genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return _genAI;
};

// Concise system prompt — fewer tokens = faster first token.
export const NGO_SYSTEM_PROMPT = `You are ReliefSync AI, an advanced Disaster Coordination & Emergency Response Assistant.
Your primary goal is to provide rapid, professional, and actionable advice during crises.

GUIDELINES:
1. Be helpful, professional, and empathetic but extremely concise.
2. If the user describes an emergency or disaster, provide a structured assessment using these exact points:
   • Category: Specify the type (e.g., Medical, Flood, Fire, Shelter, Food, etc.)
   • Urgency: Rank as Critical, High, Medium, or Low.
   • Immediate Action: Give 1-2 life-saving steps the user should take RIGHT NOW.
   • Resources Needed: List specific personnel or supplies required.
3. If the user is just greeting you or asking general questions, respond concisely and guide them toward using your assessment capabilities if they have an emergency.
4. Do not use markdown like headers or bold text unless absolutely necessary to keep tokens low and speed high.`;

// generationConfig tuned for speed: low temperature, capped tokens, no fallback.
export const GENERATION_CONFIG = {
  temperature: 0.2,       // deterministic = faster, more accurate for emergencies
  maxOutputTokens: 300,   // keeps replies short and snappy
  topP: 0.8,
  topK: 20,
};

export const getGeminiModel = () =>
  getGenAI().getGenerativeModel(
    {
      model: GEMINI_MODEL,
      generationConfig: GENERATION_CONFIG,
    },
    { apiVersion: 'v1' }
  );
