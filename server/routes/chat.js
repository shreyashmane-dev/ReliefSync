import { Router } from 'express';
import { generateChatReply } from '../services/chatService.js';

const chatRouter = Router();

const getErrorResponse = (error) => {
  const message = error instanceof Error ? error.message : 'Failed to generate Gemini response.';

  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return {
      status: 429,
      error: 'Gemini quota is currently exceeded for this API key. Try again later or switch to a billed key/project.',
    };
  }

  if (message.includes('503')) {
    return {
      status: 503,
      error: 'Gemini is temporarily under heavy load. Please retry in a moment.',
    };
  }

  if (message.includes('404') || message.includes('not found')) {
    return {
      status: 500,
      error: 'The configured Gemini model is not available for this API key.',
    };
  }

  return {
    status: 500,
    error: message,
  };
};

chatRouter.post('/', async (req, res) => {
  const { message } = req.body ?? {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  try {
    const reply = await generateChatReply(message);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Gemini API error:', error);
    const errorResponse = getErrorResponse(error);
    return res.status(errorResponse.status).json({ error: errorResponse.error });
  }
});

export default chatRouter;
