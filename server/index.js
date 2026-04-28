import dotenv from 'dotenv';
dotenv.config();

import './config/firebase-admin.js'; // Initialize Firebase FIRST
import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import chatRouter from './routes/chat.js';
import aiRouter from './routes/aiRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import { initializeSocket } from './services/socketService.js';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.CLIENT_ORIGIN,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
const server = http.createServer(app);
initializeSocket(server);

const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.use('/api/chat', chatRouter);
app.use('/api/ai', aiRouter);
app.use('/api/notifications', notificationRouter);

// Serve the built Vite app from the same Express service in production.
app.use(express.static(distPath));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

server.listen(PORT, HOST, () => {
  console.log(`ReliefSync app listening on http://${HOST}:${PORT}`);
});
