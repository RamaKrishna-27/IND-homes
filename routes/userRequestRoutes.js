const express = require('express');
const db = require('../config/db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireUser);

// GET /api/user/requests - the logged-in user's own contact requests
router.get('/', async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT cr.id, cr.request_type, cr.status, cr.created_at, p.title as property_title, o.name as owner_name
       FROM contact_requests cr
       JOIN properties p ON p.id = cr.property_id
       JOIN owners o ON o.id = cr.owner_id
       WHERE cr.user_id = ? ORDER BY cr.created_at DESC`
    )
    .all(req.user.id);
  res.json({ requests: rows });
});

module.exports = router;
