import { Router } from 'express';
import { geminiService } from '../services/geminiService.js';

const chatRouter = Router();

/**
 * Standard Chat Endpoint (Requirement #8)
 * POST /api/chat
 */
chatRouter.post('/', async (req, res) => {
  const { message } = req.body ?? {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  try {
    const result = await geminiService.chat(message);
    return res.status(result.ok ? 200 : 503).json({
      reply: result.reply,
      error: result.error,
      code: result.code
    });
  } catch (error) {
    console.error('Gemini chat error:', error);
    return res.status(500).json({ 
      reply: "System busy, please try again in a few seconds." 
    });
  }
});

/**
 * Legacy Sync Alias
 */
chatRouter.post('/sync', async (req, res) => {
  const { message } = req.body ?? {};
  try {
    const result = await geminiService.chat(message);
    return res.status(result.ok ? 200 : 503).json({
      reply: result.reply,
      error: result.error,
      code: result.code
    });
  } catch (error) {
    return res.status(500).json({ reply: "System busy." });
  }
});

export default chatRouter;
