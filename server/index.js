import dotenv from 'dotenv';
import express from 'express';
import chatRouter from './routes/chat.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.use('/api/chat', chatRouter);

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`ReliefSync API listening on http://localhost:${PORT}`);
});
