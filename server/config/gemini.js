import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// gemini-2.0-flash is the fastest low-latency model — critical for emergency response.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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
export const NGO_SYSTEM_PROMPT = `You are an emergency NGO assistant. Be concise and fast.
For every problem respond with ONLY these 4 short bullet points:
• Category: <disaster/medical/shelter/food/security/other>
• Urgency: <Critical/High/Medium/Low>
• Action: <immediate step to take>
• Resources: <what/who is needed>`;

// generationConfig tuned for speed: low temperature, capped tokens, no fallback.
export const GENERATION_CONFIG = {
  temperature: 0.2,       // deterministic = faster, more accurate for emergencies
  maxOutputTokens: 300,   // keeps replies short and snappy
  topP: 0.8,
  topK: 20,
};

export const getGeminiModel = () =>
  getGenAI().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: GENERATION_CONFIG,
  });
