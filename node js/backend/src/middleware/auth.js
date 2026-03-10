/**
 * Authentication middleware – verifies JWT from Authorization header.
 * Attaches decoded user payload to req.user on success.
 */
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'meetclone_fallback_secret';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, displayName }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generate a JWT for a user (used at login/signup).
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, displayName: user.displayName },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
