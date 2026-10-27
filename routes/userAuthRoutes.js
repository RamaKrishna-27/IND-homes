const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { requireUser } = require('../middleware/auth');
const { generateResetToken, hashToken } = require('../utils/tokens');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts. Please try again later.' }
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many password reset requests. Please wait a while before trying again.' }
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
router.post('/logout', (req, res) => {
  res.clearCookie('user_token');
  res.json({ message: 'Logged out.' });
});

// POST /api/user/auth/forgot-password
router.post('/forgot-password', resetLimiter, async (req, res) => {
  const { email } = req.body || {};
  const generic = { message: 'If an account exists for this email, a password reset link has been sent.' };

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

  if (!user) {
    return res.json(generic);
  }

  const { rawToken, tokenHash, expiresAt } = generateResetToken();
  await db.prepare('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?').run(
    tokenHash,
    expiresAt,
    user.id
  );

  const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl}/reset-password.html?role=user&token=${rawToken}&email=${encodeURIComponent(user.email)}`;

  await sendMail({
    to: user.email,
    subject: 'IND Homes User Password Reset',
    text: `Hello ${user.name},\n\nYou requested a password reset for your IND Homes account.\n\nReset your password here:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can safely ignore this email.`,
    html: `<p>Hello <strong>${user.name}</strong>,</p>
           <p>You requested a password reset for your IND Homes account.</p>
           <p><a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#1c6f5c;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Reset User Password</a></p>
           <p>Or paste this link into your browser: <br><a href="${resetUrl}">${resetUrl}</a></p>
           <p>This link expires in 30 minutes. If you did not request this, you can safely ignore this email.</p>`
  });

  res.json(generic);
});

// POST /api/user/auth/reset-password
router.post('/reset-password', resetLimiter, async (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !user.reset_token_hash || !user.reset_token_expires) {
    return res.status(400).json({ error: 'Invalid or expired reset link.' });
  }

  if (Date.now() > Number(user.reset_token_expires)) {
    return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
  }

  const suppliedHash = hashToken(token);
  if (suppliedHash !== user.reset_token_hash) {
    return res.status(400).json({ error: 'Invalid or expired reset link.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  await db.prepare(
    'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?'
  ).run(newHash, user.id);

  res.json({ message: 'Password successfully changed. You can now log in.' });
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
