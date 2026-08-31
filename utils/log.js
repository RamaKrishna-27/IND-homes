const db = require('../config/db');

function logActivity({ adminId, adminEmail, action, details }) {
  db.prepare(
    `INSERT INTO activity_logs (admin_id, admin_email, action, details) VALUES (?, ?, ?, ?)`
  ).run(adminId || null, adminEmail || null, action, details || null);
}

function notifyAdmin({ type, title, message, link }) {
  db.prepare(
    `INSERT INTO notifications (audience, type, title, message, link) VALUES ('ADMIN', ?, ?, ?, ?)`
  ).run(type, title, message, link || null);
}

function notifyOwner({ ownerId, type, title, message, link }) {
  db.prepare(
    `INSERT INTO notifications (audience, owner_id, type, title, message, link) VALUES ('OWNER', ?, ?, ?, ?, ?)`
  ).run(ownerId, type, title, message, link || null);
}

module.exports = { logActivity, notifyAdmin, notifyOwner };
