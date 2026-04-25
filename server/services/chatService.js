import { getGeminiModel, NGO_SYSTEM_PROMPT } from '../config/gemini.js';

const buildPrompt = (message) =>
  `${NGO_SYSTEM_PROMPT}\n\nUser problem:\n${message.trim()}`;

const FALLBACK_RESPONSE = "I'm currently receiving too many requests. Please try again in a few moments, or if this is an emergency, contact local authorities immediately.";

/**
 * Streams the Gemini reply back as an async generator (SSE path).
 */
export async function* streamChatReply(message) {
  const cleanMessage = message?.trim();
  if (!cleanMessage) throw new Error('A user message is required.');

  const model = getGeminiModel();
  
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      const result = await model.generateContentStream(buildPrompt(cleanMessage));
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
      return; // Success
    } catch (error) {
      attempts++;
      const isQuotaError = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
      
      if (isQuotaError && attempts < maxAttempts) {
        const delay = Math.pow(2, attempts) * 1000; // Exponential backoff: 2s, 4s...
        console.warn(`Gemini rate limited (429). Retrying in ${delay}ms (attempt ${attempts})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error('Gemini stream final error:', error);
      yield FALLBACK_RESPONSE;
      return;
    }
  }
}

/**
 * Returns the full reply as a single string (sync/fallback path).
 */
export async function generateChatReply(message) {
  const cleanMessage = message?.trim();
  if (!cleanMessage) throw new Error('A user message is required.');

  const model = getGeminiModel();
  
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const result = await model.generateContent(buildPrompt(cleanMessage));
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      attempts++;
      const isQuotaError = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
      
      if (isQuotaError && attempts < maxAttempts) {
        const delay = Math.pow(2, attempts) * 1000;
        console.warn(`Gemini rate limited (429). Retrying sync in ${delay}ms (attempt ${attempts})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error('Gemini sync final error:', error);
      return FALLBACK_RESPONSE;
    }
  }
}
