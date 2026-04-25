import { getGeminiModel, NGO_SYSTEM_PROMPT } from '../config/gemini.js';

const buildPrompt = (message) =>
  `${NGO_SYSTEM_PROMPT}\n\nUser problem:\n${message.trim()}`;

/**
 * Streams the Gemini reply back as an async generator (SSE path).
 */
export async function* streamChatReply(message) {
  const cleanMessage = message?.trim();
  if (!cleanMessage) throw new Error('A user message is required.');

  const model = getGeminiModel();
  const result = await model.generateContentStream(buildPrompt(cleanMessage));

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/**
 * Returns the full reply as a single string (sync/fallback path).
 */
export async function generateChatReply(message) {
  const cleanMessage = message?.trim();
  if (!cleanMessage) throw new Error('A user message is required.');

  const model = getGeminiModel();
  const result = await model.generateContent(buildPrompt(cleanMessage));
  const response = await result.response;
  return response.text().trim();
}
