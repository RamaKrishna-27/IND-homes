const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/dashboard/stats
router.get('/stats', (req, res) => {
  const count = (sql, ...args) => db.prepare(sql).get(...args).c;

  const stats = {
    totalUsers: count('SELECT COUNT(*) c FROM users'),
    totalOwners: count('SELECT COUNT(*) c FROM owners'),
    totalProperties: count('SELECT COUNT(*) c FROM properties'),
    pendingProperties: count("SELECT COUNT(*) c FROM properties WHERE status = 'PENDING_APPROVAL'"),
    approvedProperties: count("SELECT COUNT(*) c FROM properties WHERE status = 'APPROVED'"),
    rejectedProperties: count("SELECT COUNT(*) c FROM properties WHERE status = 'REJECTED'"),
    contactRequests: count('SELECT COUNT(*) c FROM contact_requests'),
    scheduledVisits: count("SELECT COUNT(*) c FROM contact_requests WHERE request_type = 'Schedule Visit'"),
    reportedProperties: count("SELECT COUNT(*) c FROM reported_properties WHERE status = 'OPEN'")
  };

  // Simple time series: properties submitted per day, last 14 days (for a chart)
  const trend = db
    .prepare(
      `SELECT date(submitted_at) as day, COUNT(*) as count
       FROM properties
       WHERE submitted_at IS NOT NULL
       GROUP BY day
       ORDER BY day DESC
       LIMIT 14`
    )
    .all()
    .reverse();

  res.json({ stats, trend });
});

// GET /api/admin/dashboard/notifications
router.get('/notifications', (req, res) => {
  const notifications = db
    .prepare(`SELECT * FROM notifications WHERE audience = 'ADMIN' ORDER BY created_at DESC LIMIT 50`)
    .all();
  const unreadCount = db
    .prepare(`SELECT COUNT(*) c FROM notifications WHERE audience = 'ADMIN' AND is_read = 0`)
    .get().c;
  res.json({ notifications, unreadCount });
});

// POST /api/admin/dashboard/notifications/:id/read
router.post('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marked as read.' });
});

module.exports = router;
