const db = require('../config/db');

async function logActivity({ adminId, adminEmail, action, details }) {
  try {
    await db.prepare(
      `INSERT INTO activity_logs (admin_id, admin_email, action, details) VALUES (?, ?, ?, ?)`
    ).run(adminId || null, adminEmail || null, action, details || null);
  } catch (err) {
    console.error('logActivity error:', err.message);
  }
}

async function notifyAdmin({ type, title, message, link }) {
  try {
    await db.prepare(
      `INSERT INTO notifications (audience, type, title, message, link) VALUES ('ADMIN', ?, ?, ?, ?)`
    ).run(type, title, message, link || null);
  } catch (err) {
    console.error('notifyAdmin error:', err.message);
  }
}

async function notifyOwner({ ownerId, type, title, message, link }) {
  try {
    await db.prepare(
      `INSERT INTO notifications (audience, owner_id, type, title, message, link) VALUES ('OWNER', ?, ?, ?, ?, ?)`
    ).run(ownerId, type, title, message, link || null);
  } catch (err) {
    console.error('notifyOwner error:', err.message);
  }
}

module.exports = { logActivity, notifyAdmin, notifyOwner };
