const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/log');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/contact-requests?status=&type=
router.get('/', async (req, res) => {
  const { status, type } = req.query;
  let sql = `
    SELECT cr.*, u.name as user_name, p.title as property_title, o.name as owner_name
    FROM contact_requests cr
    JOIN users u ON u.id = cr.user_id
    JOIN properties p ON p.id = cr.property_id
    JOIN owners o ON o.id = cr.owner_id
    WHERE 1=1
  `;
  const params = [];
  if (status && status !== 'All') {
    sql += ' AND cr.status = ?';
    params.push(status);
  }
  if (type && type !== 'All') {
    sql += ' AND cr.request_type = ?';
    params.push(type);
  }
  sql += ' ORDER BY cr.created_at DESC';

  const rows = await db.prepare(sql).all(...params);
  res.json({ requests: rows || [] });
});

router.get('/:id', async (req, res) => {
  const cr = await db
    .prepare(
      `SELECT cr.*, u.name as user_name, u.email as user_email, u.mobile as user_mobile,
              p.title as property_title, o.name as owner_name, o.email as owner_email, o.mobile as owner_mobile
       FROM contact_requests cr
       JOIN users u ON u.id = cr.user_id
       JOIN properties p ON p.id = cr.property_id
       JOIN owners o ON o.id = cr.owner_id
       WHERE cr.id = ?`
    )
    .get(req.params.id);
  if (!cr) return res.status(404).json({ error: 'Request not found.' });
  res.json({ request: cr });
});

// POST /api/admin/contact-requests/:id/status  body: { status }
router.post('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['PENDING', 'CONTACTED', 'RESPONDED', 'CLOSED', 'CANCELLED'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
  }

  const cr = await db.prepare('SELECT * FROM contact_requests WHERE id = ?').get(req.params.id);
  if (!cr) return res.status(404).json({ error: 'Request not found.' });

  await db.prepare('UPDATE contact_requests SET status = ? WHERE id = ?').run(status, cr.id);
  await logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'CONTACT_REQUEST_STATUS_UPDATED', details: `Request #${cr.id} -> ${status}` });
  res.json({ message: 'Status updated.' });
});

module.exports = router;
