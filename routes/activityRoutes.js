const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/activity-logs?limit=100
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json({ logs });
});

module.exports = router;
