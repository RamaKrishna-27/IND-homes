const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/log');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/users?search=...
router.get('/', async (req, res) => {
  const { search } = req.query;
  let sql = `
    SELECT u.*,
      (SELECT COUNT(*) FROM contact_requests c WHERE c.user_id = u.id) as enquiry_count
    FROM users u WHERE 1=1
  `;
  const params = [];
  if (search) {
    sql += ' AND (u.id = ? OR u.name LIKE ? OR u.email LIKE ?)';
    params.push(Number(search) || -1, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY u.created_at DESC';
  const rows = await db.prepare(sql).all(...params);
  res.json({ users: rows || [] });
});

router.get('/:id', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

router.put('/:id', async (req, res) => {
  const { name, email, mobile, city } = req.body || {};
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  await db.prepare('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), mobile = COALESCE(?, mobile), city = COALESCE(?, city) WHERE id = ?')
    .run(name, email, mobile, city, user.id);

  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'USER_EDITED', details: `Edited user #${user.id}` });
  res.json({ message: 'User updated.' });
});

router.post('/:id/suspend', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await db.prepare(`UPDATE users SET account_status = 'SUSPENDED' WHERE id = ?`).run(user.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'USER_SUSPENDED', details: `Suspended user #${user.id}` });
  res.json({ message: 'User suspended.' });
});

router.post('/:id/activate', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await db.prepare(`UPDATE users SET account_status = 'ACTIVE' WHERE id = ?`).run(user.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'USER_ACTIVATED', details: `Activated user #${user.id}` });
  res.json({ message: 'User activated.' });
});

router.delete('/:id', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await db.prepare(`UPDATE users SET account_status = 'DELETED' WHERE id = ?`).run(user.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'USER_DELETED', details: `Deleted user #${user.id}` });
  res.json({ message: 'User deleted.' });
});

module.exports = router;
