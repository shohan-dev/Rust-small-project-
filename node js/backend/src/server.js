/**
 * MeetClone Backend – Express + WebSocket Server
 *
 * Provides:
 *  - REST API for auth, rooms, profiles
 *  - WebSocket signaling for WebRTC + chat
 *  - SQLite database via better-sqlite3
 */
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const { setupWebSocket } = require('./websocket');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Security & Middleware ──────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  message: { error: 'Too many requests, try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Create HTTP Server + Attach WebSocket ──────────────────────────────────────
const server = http.createServer(app);
setupWebSocket(server);

// ─── Initialize DB then start listening ──────────────────────────────────────────
initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n🚀 MeetClone Backend running on http://localhost:${PORT}`);
      console.log(`   REST API:  http://localhost:${PORT}/api`);
      console.log(`   WebSocket: ws://localhost:${PORT}/ws\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
