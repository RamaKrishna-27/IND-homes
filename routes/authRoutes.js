const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { generateResetToken, hashToken } = require('../utils/tokens');
const { sendMail } = require('../utils/mailer');
const { logActivity } = require('../utils/log');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' }
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests. Please try again later.' }
});

const JWT_SECRET = process.env.JWT_SECRET || 'ind_homes_secret_jwt_key_default_development_2026';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000 // 8 hours
};

// POST /api/admin/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase().trim());
  if (!admin) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = bcrypt.compareSync(password, admin.password_hash) || bcrypt.compareSync(String(password).trim(), admin.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('admin_token', token, COOKIE_OPTS);
  logActivity({ adminId: admin.id, adminEmail: admin.email, action: 'ADMIN_LOGIN', details: 'Admin logged in.' });

  res.json({
    message: 'Login successful.',
    token, // also returned for clients that prefer Authorization header
    admin: { id: admin.id, email: admin.email, name: admin.name }
  });
});

// POST /api/admin/auth/logout
router.post('/logout', requireAdmin, (req, res) => {
  res.clearCookie('admin_token');
  logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'ADMIN_LOGOUT' });
  res.json({ message: 'Logged out.' });
});

// GET /api/admin/auth/me
router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// POST /api/admin/auth/forgot-password
router.post('/forgot-password', resetLimiter, async (req, res) => {
  const { email } = req.body || {};
  const generic = { message: 'If an account exists for this email, a password reset link has been sent.' };

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase().trim());

  // Always behave the same way whether or not the account exists, to prevent account enumeration.
  if (!admin) {
    return res.json(generic);
  }

  const { rawToken, tokenHash, expiresAt } = generateResetToken();
  db.prepare('UPDATE admins SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?').run(
    tokenHash,
    expiresAt,
    admin.id
  );

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(admin.email)}`;

  await sendMail({
    to: admin.email,
    subject: 'IND Homes Admin Password Reset',
    text: `Someone requested a password reset for your IND Homes administrator account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Someone requested a password reset for your IND Homes administrator account.</p>
           <p><a href="${resetUrl}">Reset Admin Password</a></p>
           <p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`
  });

  res.json(generic);
});

// POST /api/admin/auth/reset-password
router.post('/reset-password', resetLimiter, (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase().trim());
  if (!admin || !admin.reset_token_hash || !admin.reset_token_expires) {
    return res.status(400).json({ error: 'Invalid or expired reset link.' });
  }

  if (Date.now() > admin.reset_token_expires) {
    return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
  }

  const suppliedHash = hashToken(token);
  if (suppliedHash !== admin.reset_token_hash) {
    return res.status(400).json({ error: 'Invalid or expired reset link.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare(
    'UPDATE admins SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?'
  ).run(newHash, admin.id);

  logActivity({ adminId: admin.id, adminEmail: admin.email, action: 'PASSWORD_RESET', details: 'Password reset via email link.' });

  res.json({ message: 'Password successfully changed. You can now log in.' });
});

// POST /api/admin/auth/change-password (requires current password, must be logged in)
router.post('/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'New password and confirmation do not match.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, admin.id);

  logActivity({ adminId: admin.id, adminEmail: admin.email, action: 'PASSWORD_CHANGE', details: 'Password changed from settings.' });

  res.json({ message: 'Password changed successfully.' });
});

module.exports = router;
