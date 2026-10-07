const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts. Please try again later.' }
});

const JWT_SECRET = process.env.JWT_SECRET || 'ind_homes_secret_jwt_key_default_development_2026';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
};

function signUser(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: 'user' }, JWT_SECRET, {
    expiresIn: '30d'
  });
}

// POST /api/user/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, mobile, city } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await db
    .prepare('INSERT INTO users (name, email, mobile, city, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), normalizedEmail, mobile || null, city || null, passwordHash);

  const user = { id: result.lastInsertRowid, email: normalizedEmail, name: name.trim() };
  const token = signUser(user);
  res.cookie('user_token', token, COOKIE_OPTS);

  res.status(201).json({ message: 'Account created.', token, user });
});

// POST /api/user/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || (!bcrypt.compareSync(password, user.password_hash) && !bcrypt.compareSync(String(password).trim(), user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.account_status !== 'ACTIVE') {
    return res.status(403).json({ error: `Your account is ${user.account_status.toLowerCase()}. Contact support for help.` });
  }

  const token = signUser(user);
  res.cookie('user_token', token, COOKIE_OPTS);
  res.json({ message: 'Login successful.', token, user: { id: user.id, email: user.email, name: user.name } });
});

// POST /api/user/auth/logout
router.post('/logout', requireUser, (req, res) => {
  res.clearCookie('user_token');
  res.json({ message: 'Logged out.' });
});

// GET /api/user/auth/me
router.get('/me', requireUser, async (req, res) => {
  const user = await db
    .prepare('SELECT id, name, email, mobile, city, account_status, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

module.exports = router;
