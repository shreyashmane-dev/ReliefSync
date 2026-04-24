import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './routes/chat.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.use('/api/chat', chatRouter);

// Serve the built Vite app from the same Express service in production.
app.use(express.static(distPath));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, HOST, () => {
  console.log(`ReliefSync app listening on http://${HOST}:${PORT}`);
});
