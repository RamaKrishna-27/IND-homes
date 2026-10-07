const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/log');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/owners?search=...
router.get('/', async (req, res) => {
  const { search } = req.query;
  let sql = `
    SELECT o.*,
      (SELECT COUNT(*) FROM properties p WHERE p.owner_id = o.id) as total_properties,
      (SELECT COUNT(*) FROM properties p WHERE p.owner_id = o.id AND p.status = 'APPROVED') as approved_properties,
      (SELECT COUNT(*) FROM properties p WHERE p.owner_id = o.id AND p.status = 'PENDING_APPROVAL') as pending_properties
    FROM owners o WHERE 1=1
  `;
  const params = [];
  if (search) {
    sql += ' AND (o.id = ? OR o.name LIKE ? OR o.email LIKE ?)';
    params.push(Number(search) || -1, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY o.created_at DESC';

  const rows = await db.prepare(sql).all(...params);
  res.json({ owners: rows || [] });
});

// GET /api/admin/owners/:id
router.get('/:id', async (req, res) => {
  const owner = await db.prepare('SELECT * FROM owners WHERE id = ?').get(req.params.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found.' });
  const properties = await db.prepare('SELECT id, title, status, city, area, price FROM properties WHERE owner_id = ?').all(owner.id);
  res.json({ owner, properties: properties || [] });
});

router.post('/:id/verify', async (req, res) => {
  const owner = await db.prepare('SELECT * FROM owners WHERE id = ?').get(req.params.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found.' });
  await db.prepare(`UPDATE owners SET verification_status = 'VERIFIED' WHERE id = ?`).run(owner.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'OWNER_VERIFIED', details: `Verified owner #${owner.id} (${owner.name})` });
  res.json({ message: 'Owner verified.' });
});

router.post('/:id/suspend', async (req, res) => {
  const owner = await db.prepare('SELECT * FROM owners WHERE id = ?').get(req.params.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found.' });
  await db.prepare(`UPDATE owners SET account_status = 'SUSPENDED' WHERE id = ?`).run(owner.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'OWNER_SUSPENDED', details: `Suspended owner #${owner.id} (${owner.name})` });
  res.json({ message: 'Owner suspended.' });
});

router.post('/:id/activate', async (req, res) => {
  const owner = await db.prepare('SELECT * FROM owners WHERE id = ?').get(req.params.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found.' });
  await db.prepare(`UPDATE owners SET account_status = 'ACTIVE' WHERE id = ?`).run(owner.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'OWNER_ACTIVATED', details: `Activated owner #${owner.id} (${owner.name})` });
  res.json({ message: 'Owner activated.' });
});

router.delete('/:id', async (req, res) => {
  const owner = await db.prepare('SELECT * FROM owners WHERE id = ?').get(req.params.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found.' });
  await db.prepare(`UPDATE owners SET account_status = 'DELETED' WHERE id = ?`).run(owner.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'OWNER_DELETED', details: `Deleted owner #${owner.id} (${owner.name})` });
  res.json({ message: 'Owner deleted.' });
});

module.exports = router;
