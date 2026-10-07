const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/dashboard/stats
router.get('/stats', async (req, res) => {
  const count = async (sql, ...args) => {
    const row = await db.prepare(sql).get(...args);
    return Number(row?.c || 0);
  };

  const [
    totalUsers,
    totalOwners,
    totalProperties,
    pendingProperties,
    approvedProperties,
    rejectedProperties,
    contactRequests,
    scheduledVisits,
    reportedProperties
  ] = await Promise.all([
    count('SELECT COUNT(*) as c FROM users'),
    count('SELECT COUNT(*) as c FROM owners'),
    count('SELECT COUNT(*) as c FROM properties'),
    count("SELECT COUNT(*) as c FROM properties WHERE status = 'PENDING_APPROVAL'"),
    count("SELECT COUNT(*) as c FROM properties WHERE status = 'APPROVED'"),
    count("SELECT COUNT(*) as c FROM properties WHERE status = 'REJECTED'"),
    count('SELECT COUNT(*) as c FROM contact_requests'),
    count("SELECT COUNT(*) as c FROM contact_requests WHERE request_type = 'Schedule Visit'"),
    count("SELECT COUNT(*) as c FROM reported_properties WHERE status = 'OPEN'")
  ]);

  const stats = {
    totalUsers,
    totalOwners,
    totalProperties,
    pendingProperties,
    approvedProperties,
    rejectedProperties,
    contactRequests,
    scheduledVisits,
    reportedProperties
  };

  // Simple time series: properties submitted per day, last 14 days (for a chart)
  const trendRows = await db
    .prepare(
      `SELECT date(submitted_at) as day, COUNT(*) as count
       FROM properties
       WHERE submitted_at IS NOT NULL
       GROUP BY date(submitted_at)
       ORDER BY day DESC
       LIMIT 14`
    )
    .all();

  const trend = (trendRows || []).reverse();

  res.json({ stats, trend });
});

// GET /api/admin/dashboard/notifications
router.get('/notifications', async (req, res) => {
  const notifications = await db
    .prepare(`SELECT * FROM notifications WHERE audience = 'ADMIN' ORDER BY created_at DESC LIMIT 50`)
    .all();
  const unreadRow = await db
    .prepare(`SELECT COUNT(*) as c FROM notifications WHERE audience = 'ADMIN' AND is_read = 0`)
    .get();
  const unreadCount = Number(unreadRow?.c || 0);
  res.json({ notifications: notifications || [], unreadCount });
});

// POST /api/admin/dashboard/notifications/:id/read
router.post('/notifications/:id/read', async (req, res) => {
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marked as read.' });
});

module.exports = router;
