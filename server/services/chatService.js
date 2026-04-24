import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModel, GEMINI_MODEL, NGO_SYSTEM_PROMPT } from '../config/gemini.js';

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

const isMissingModelError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('404 Not Found') || message.includes('is not found');
};

const generateWithModel = async (model, prompt) => {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
};

export const generateChatReply = async (message) => {
  const cleanMessage = message?.trim();

  if (!cleanMessage) {
    throw new Error('A user message is required.');
  }

  const model = getGeminiModel();

  const prompt = `${NGO_SYSTEM_PROMPT}

User problem:
${cleanMessage}
`;

  try {
    return await generateWithModel(model, prompt);
  } catch (error) {
    if (!isMissingModelError(error)) {
      throw error;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const fallbackName = FALLBACK_MODELS.find((candidate) => candidate !== GEMINI_MODEL);
    if (!apiKey || !fallbackName) {
      throw error;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const fallbackModel = genAI.getGenerativeModel({ model: fallbackName });
    return generateWithModel(fallbackModel, prompt);
  }
};
