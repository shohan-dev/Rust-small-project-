/**
 * Authentication routes – sign up, log in, get current user, update profile.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authMiddleware, generateToken } = require('../middleware/auth');

const router = express.Router();

// Random avatar color generator
const COLORS = ['#4A90D9','#E74C3C','#2ECC71','#F39C12','#9B59B6','#1ABC9C','#E67E22','#3498DB'];
function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * POST /api/auth/signup
 * Body: { email, password, displayName }
 */
router.post('/signup', (req, res) => {
  try {
    const db = getDB();
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const name = displayName || email.split('@')[0];
    const color = randomColor();

    db.prepare(
      'INSERT INTO users (id, email, password, displayName, avatarColor) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, hashedPassword, name, color);

    const user = { id, email, displayName: name, avatarColor: color };
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', (req, res) => {
  try {
    const db = getDB();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
    };
    const token = generateToken(payload);

    res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me – get current authenticated user
 */
router.get('/me', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const user = db
      .prepare('SELECT id, email, displayName, avatarColor, avatarUrl, createdAt FROM users WHERE id = ?')
      .get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/profile – update display name / avatar color
 * Body: { displayName, avatarColor }
 */
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const { displayName, avatarColor } = req.body;
    const updates = [];
    const params = [];

    if (displayName) {
      updates.push('displayName = ?');
      params.push(displayName);
    }
    if (avatarColor) {
      updates.push('avatarColor = ?');
      params.push(avatarColor);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    updates.push("updatedAt = datetime('now')");
    params.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db
      .prepare('SELECT id, email, displayName, avatarColor, avatarUrl, createdAt FROM users WHERE id = ?')
      .get(req.user.id);

    res.json({ user });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
