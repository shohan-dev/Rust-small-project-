/**
 * Room management routes – create, list, join, get details.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * Generate a human-friendly room code like "abc-defg-hij"
 */
function generateRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * 26)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

/**
 * POST /api/rooms – create a new room
 * Body: { name? }
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const { name } = req.body;
    const id = generateRoomCode();
    const roomName = name || `Room ${id}`;

    db.prepare('INSERT INTO rooms (id, name, createdBy) VALUES (?, ?, ?)').run(
      id,
      roomName,
      req.user.id
    );

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    res.status(201).json({ room });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rooms – list rooms the current user created or participated in
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const rooms = db.prepare(`
      SELECT DISTINCT r.* FROM rooms r
      LEFT JOIN participants p ON p.roomId = r.id
      WHERE r.createdBy = ? OR p.userId = ?
      ORDER BY r.createdAt DESC
    `).all(req.user.id, req.user.id);

    res.json({ rooms });
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rooms/:id – get room details with participants
 */
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const participants = db.prepare(`
      SELECT u.id, u.displayName, u.avatarColor, u.avatarUrl, p.joinedAt
      FROM participants p
      JOIN users u ON u.id = p.userId
      WHERE p.roomId = ? AND p.leftAt IS NULL
    `).all(req.params.id);

    const messages = db.prepare(`
      SELECT m.id, m.content, m.createdAt, u.displayName, u.avatarColor
      FROM messages m
      JOIN users u ON u.id = m.userId
      WHERE m.roomId = ?
      ORDER BY m.createdAt ASC
      LIMIT 100
    `).all(req.params.id);

    res.json({ room, participants, messages });
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rooms/:id/join – record a user joining a room
 */
router.post('/:id/join', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Mark any previous non-left entries as left
    db.prepare(
      "UPDATE participants SET leftAt = datetime('now') WHERE roomId = ? AND userId = ? AND leftAt IS NULL"
    ).run(req.params.id, req.user.id);

    // Insert new join record
    db.prepare('INSERT INTO participants (roomId, userId) VALUES (?, ?)').run(
      req.params.id,
      req.user.id
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rooms/:id/leave – record user leaving a room
 */
router.post('/:id/leave', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    db.prepare(
      "UPDATE participants SET leftAt = datetime('now') WHERE roomId = ? AND userId = ? AND leftAt IS NULL"
    ).run(req.params.id, req.user.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Leave room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
