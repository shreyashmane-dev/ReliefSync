import { Router } from 'express';
import { vertexIntelligenceService } from '../services/vertexIntelligenceService.js';

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

  try {
    const result = await vertexIntelligenceService.generateRoleCopilotReply({
      role: req.body?.role || 'user',
      message,
      userData: req.body?.userData || {},
      context: req.body?.context || {},
    });
    return res.status(200).json({
      reply: result.reply,
      nextActions: result.nextActions,
      riskFlags: result.riskFlags,
      suggestedTools: result.suggestedTools,
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
    const result = await vertexIntelligenceService.generateRoleCopilotReply({
      role: req.body?.role || 'user',
      message,
      userData: req.body?.userData || {},
      context: req.body?.context || {},
    });
    return res.status(200).json({
      reply: result.reply,
      nextActions: result.nextActions,
      riskFlags: result.riskFlags,
      suggestedTools: result.suggestedTools,
    });
  } catch (error) {
    return res.status(500).json({ reply: "System busy." });
  }
});

export default chatRouter;
