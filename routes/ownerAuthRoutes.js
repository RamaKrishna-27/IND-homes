const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { requireOwner } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/log');
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

function signOwner(owner) {
  return jwt.sign({ id: owner.id, email: owner.email, name: owner.name, role: 'owner' }, JWT_SECRET, {
    expiresIn: '30d'
  });
}

// POST /api/owner/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, mobile, ownerType } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db.prepare('SELECT id FROM owners WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await db
    .prepare('INSERT INTO owners (name, email, mobile, password_hash, owner_type) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), normalizedEmail, mobile || null, passwordHash, ownerType || 'Individual');

  const owner = { id: result.lastInsertRowid, email: normalizedEmail, name: name.trim() };
  const token = signOwner(owner);
  res.cookie('owner_token', token, COOKIE_OPTS);

  await notifyAdmin({
    type: 'NEW_OWNER_REGISTERED',
    title: 'New Owner Registered',
    message: `${owner.name} (${owner.email}) created an owner account.`,
    link: `/admin/owners/${owner.id}`
  });

  res.status(201).json({ message: 'Account created.', token, owner });
});

// POST /api/owner/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const owner = await db.prepare('SELECT * FROM owners WHERE email = ?').get(email.toLowerCase().trim());
  if (!owner || (!bcrypt.compareSync(password, owner.password_hash) && !bcrypt.compareSync(String(password).trim(), owner.password_hash))) {
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
router.post('/logout', (req, res) => {
  res.clearCookie('owner_token');
  res.json({ message: 'Logged out.' });
});

// POST /api/owner/auth/forgot-password
router.post('/forgot-password', resetLimiter, async (req, res) => {
  const { email } = req.body || {};
  const generic = { message: 'If an account exists for this email, a password reset link has been sent.' };

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const owner = await db.prepare('SELECT * FROM owners WHERE email = ?').get(email.toLowerCase().trim());

  if (!owner) {
    return res.json(generic);
  }

  const { rawToken, tokenHash, expiresAt } = generateResetToken();
  await db.prepare('UPDATE owners SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?').run(
    tokenHash,
    expiresAt,
    owner.id
  );

  const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl}/reset-password.html?role=owner&token=${rawToken}&email=${encodeURIComponent(owner.email)}`;

  await sendMail({
    to: owner.email,
    subject: 'IND Homes Owner Password Reset',
    text: `Hello ${owner.name},\n\nYou requested a password reset for your IND Homes owner account.\n\nReset your password here:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can safely ignore this email.`,
    html: `<p>Hello <strong>${owner.name}</strong>,</p>
           <p>You requested a password reset for your IND Homes property owner account.</p>
           <p><a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#1c6f5c;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Reset Owner Password</a></p>
           <p>Or paste this link into your browser: <br><a href="${resetUrl}">${resetUrl}</a></p>
           <p>This link expires in 30 minutes. If you did not request this, you can safely ignore this email.</p>`
  });

  res.json(generic);
});

// POST /api/owner/auth/reset-password
router.post('/reset-password', resetLimiter, async (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const owner = await db.prepare('SELECT * FROM owners WHERE email = ?').get(email.toLowerCase().trim());
  if (!owner || !owner.reset_token_hash || !owner.reset_token_expires) {
    return res.status(400).json({ error: 'Invalid or expired reset link.' });
  }

  if (Date.now() > Number(owner.reset_token_expires)) {
    return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
  }

  const suppliedHash = hashToken(token);
  if (suppliedHash !== owner.reset_token_hash) {
    return res.status(400).json({ error: 'Invalid or expired reset link.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  await db.prepare(
    'UPDATE owners SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?'
  ).run(newHash, owner.id);

  res.json({ message: 'Password successfully changed. You can now log in.' });
});

// GET /api/owner/auth/me
router.get('/me', requireOwner, async (req, res) => {
  const owner = await db
    .prepare('SELECT id, name, email, mobile, owner_type, verification_status, account_status, created_at FROM owners WHERE id = ?')
    .get(req.owner.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found.' });
  res.json({ owner });
});

module.exports = router;
