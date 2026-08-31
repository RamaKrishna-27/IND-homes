const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { requireOwner } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/log');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts. Please try again later.' }
const JWT_SECRET = process.env.JWT_SECRET || 'ind_homes_secret_jwt_key_default_development_2026';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
};

function signOwner(owner) {
  return jwt.sign({ id: owner.id, email: owner.email, name: owner.name, role: 'owner' }, JWT_SECRET, {
    expiresIn: '30d'
  });
}

// POST /api/owner/auth/register
router.post('/register', authLimiter, (req, res) => {
  const { name, email, password, mobile, ownerType } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM owners WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO owners (name, email, mobile, password_hash, owner_type) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), normalizedEmail, mobile || null, passwordHash, ownerType || 'Individual');

  const owner = { id: result.lastInsertRowid, email: normalizedEmail, name: name.trim() };
  const token = signOwner(owner);
  res.cookie('owner_token', token, COOKIE_OPTS);

  notifyAdmin({
    type: 'NEW_OWNER_REGISTERED',
    title: 'New Owner Registered',
    message: `${owner.name} (${owner.email}) created an owner account.`,
    link: `/admin/owners/${owner.id}`
  });

  res.status(201).json({ message: 'Account created.', token, owner });
});

// POST /api/owner/auth/login
router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const owner = db.prepare('SELECT * FROM owners WHERE email = ?').get(email.toLowerCase().trim());
  if (!owner || !bcrypt.compareSync(password, owner.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (owner.account_status !== 'ACTIVE') {
    return res.status(403).json({ error: `Your account is ${owner.account_status.toLowerCase()}. Contact support for help.` });
  }

  const token = signOwner(owner);
  res.cookie('owner_token', token, COOKIE_OPTS);
  res.json({ message: 'Login successful.', token, owner: { id: owner.id, email: owner.email, name: owner.name } });
});

// POST /api/owner/auth/logout
router.post('/logout', requireOwner, (req, res) => {
  res.clearCookie('owner_token');
  res.json({ message: 'Logged out.' });
});

// GET /api/owner/auth/me
router.get('/me', requireOwner, (req, res) => {
  const owner = db
    .prepare('SELECT id, name, email, mobile, owner_type, verification_status, account_status, created_at FROM owners WHERE id = ?')
    .get(req.owner.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found.' });
  res.json({ owner });
});

module.exports = router;
