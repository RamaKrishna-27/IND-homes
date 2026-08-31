const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logActivity, notifyOwner } = require('../utils/log');

const router = express.Router();
router.use(requireAdmin);

function serializeProperty(p) {
  return {
    ...p,
    amenities: p.amenities ? JSON.parse(p.amenities) : [],
    images: p.images ? JSON.parse(p.images) : []
  };
}

// GET /api/admin/properties?status=PENDING_APPROVAL&search=...
router.get('/', (req, res) => {
  const { status, search } = req.query;
  let sql = `
    SELECT p.*, o.name as owner_name, o.email as owner_email, o.mobile as owner_mobile
    FROM properties p
    JOIN owners o ON o.id = p.owner_id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'All') {
    sql += ' AND p.status = ?';
    params.push(status);
  }
  if (search) {
    sql += ` AND (p.id = ? OR p.title LIKE ? OR o.name LIKE ? OR p.city LIKE ? OR p.area LIKE ?)`;
    params.push(Number(search) || -1, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY p.created_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ properties: rows.map(serializeProperty) });
});

// GET /api/admin/properties/:id  (full detail view, includes owner info)
router.get('/:id', (req, res) => {
  const p = db
    .prepare(
      `SELECT p.*, o.name as owner_name, o.email as owner_email, o.mobile as owner_mobile,
              o.owner_type, o.verification_status, o.created_at as owner_created_at
       FROM properties p JOIN owners o ON o.id = p.owner_id WHERE p.id = ?`
    )
    .get(req.params.id);

  if (!p) return res.status(404).json({ error: 'Property not found.' });

  const previousPropertiesCount = db
    .prepare('SELECT COUNT(*) c FROM properties WHERE owner_id = ? AND id != ?')
    .get(p.owner_id, p.id).c;

  res.json({ property: { ...serializeProperty(p), owner_previous_properties: previousPropertiesCount } });
});

// POST /api/admin/properties/:id/approve
router.post('/:id/approve', (req, res) => {
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Property not found.' });

  db.prepare(`UPDATE properties SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(p.id);

  notifyOwner({
    ownerId: p.owner_id,
    type: 'PROPERTY_APPROVED',
    title: 'Property Approved',
    message: `Your property "${p.title}" has been approved and is now visible on IND Homes.`,
    link: `/properties/${p.id}`
  });

  logActivity({
    adminId: req.admin.id,
    adminEmail: req.admin.email,
    action: 'PROPERTY_APPROVED',
    details: `Approved property #${p.id} (${p.title})`
  });

  res.json({ message: 'Property approved and is now publicly visible.' });
});

// POST /api/admin/properties/:id/reject   body: { reason }
router.post('/:id/reject', (req, res) => {
  const { reason } = req.body || {};
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A rejection reason is required.' });
  }

  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Property not found.' });

  db.prepare(
    `UPDATE properties SET status = 'REJECTED', rejection_reason = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(reason, p.id);

  notifyOwner({
    ownerId: p.owner_id,
    type: 'PROPERTY_REJECTED',
    title: 'Property Rejected',
    message: `Your property "${p.title}" was rejected. Reason: ${reason}`,
    link: `/properties/${p.id}`
  });

  logActivity({
    adminId: req.admin.id,
    adminEmail: req.admin.email,
    action: 'PROPERTY_REJECTED',
    details: `Rejected property #${p.id} (${p.title}) - Reason: ${reason}`
  });

  res.json({ message: 'Property rejected.' });
});

// POST /api/admin/properties/:id/request-changes   body: { note }
router.post('/:id/request-changes', (req, res) => {
  const { note } = req.body || {};
  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'Please describe what needs to be corrected.' });
  }

  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Property not found.' });

  db.prepare(
    `UPDATE properties SET status = 'CHANGES_REQUESTED', change_request_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(note, p.id);

  notifyOwner({
    ownerId: p.owner_id,
    type: 'CHANGES_REQUESTED',
    title: 'Changes Requested',
    message: `Please update your property "${p.title}": ${note}`,
    link: `/properties/${p.id}/edit`
  });

  logActivity({
    adminId: req.admin.id,
    adminEmail: req.admin.email,
    action: 'CHANGES_REQUESTED',
    details: `Requested changes on property #${p.id} (${p.title}): ${note}`
  });

  res.json({ message: 'Change request sent to owner.' });
});

// POST /api/admin/properties/:id/suspend
router.post('/:id/suspend', (req, res) => {
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Property not found.' });

  db.prepare(`UPDATE properties SET status = 'SUSPENDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(p.id);

  notifyOwner({
    ownerId: p.owner_id,
    type: 'PROPERTY_SUSPENDED',
    title: 'Property Suspended',
    message: `Your property "${p.title}" has been suspended by the platform.`,
  });

  logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'PROPERTY_SUSPENDED', details: `Suspended property #${p.id}` });
  res.json({ message: 'Property suspended.' });
});

// POST /api/admin/properties/:id/restore
router.post('/:id/restore', (req, res) => {
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Property not found.' });

  db.prepare(`UPDATE properties SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(p.id);
  logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'PROPERTY_RESTORED', details: `Restored property #${p.id}` });
  res.json({ message: 'Property restored and approved.' });
});

// DELETE /api/admin/properties/:id
router.delete('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Property not found.' });

  db.prepare(`UPDATE properties SET status = 'DELETED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(p.id);
  logActivity({ adminId: req.admin.id, adminEmail: req.admin.email, action: 'PROPERTY_DELETED', details: `Deleted property #${p.id} (${p.title})` });
  res.json({ message: 'Property deleted.' });
});

module.exports = router;
