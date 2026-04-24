import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// `gemini-pro` is not available on the current public API for this key.
// `gemini-2.5-flash` is supported and successfully responds in this project.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export const NGO_SYSTEM_PROMPT = `You are a smart NGO assistant.
Analyze the user's problem and respond with:
- Category
- Urgency level
- Suggested solution
- Required resources or volunteers`;

export const getGeminiModel = () => {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY. Add it to the server .env file before starting the API.');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
};
