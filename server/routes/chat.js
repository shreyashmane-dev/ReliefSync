import { Router } from 'express';
import { streamChatReply, generateChatReply } from '../services/chatService.js';

const chatRouter = Router();

// ─── Sync fallback endpoint (/api/chat/sync) ────────────────────────────────
// Used when the Vite proxy buffers SSE (dev mode edge-case).
chatRouter.post('/sync', async (req, res) => {
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
    console.error('Gemini sync error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate response.';
    return res.status(500).json({ error: msg });
  }
});

// ─── Streaming SSE endpoint (/api/chat) ─────────────────────────────────────
chatRouter.post('/', async (req, res) => {
  const { message } = req.body ?? {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  // Disable Nginx/proxy buffering (Vite proxy respects this header).
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    for await (const chunk of streamChatReply(message)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      // Flush after every chunk if the underlying socket supports it.
      if (typeof res.flush === 'function') res.flush();
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (error) {
    console.error('Gemini stream error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate response.';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  } finally {
    res.end();
  }
});

export default chatRouter;
