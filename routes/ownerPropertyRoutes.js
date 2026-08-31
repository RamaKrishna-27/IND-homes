const express = require('express');
const db = require('../config/db');
const { requireOwner } = require('../middleware/auth');

const router = express.Router();
router.use(requireOwner);

// GET /api/owner/properties - the logged-in owner's own listings
router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT id, title, description, city, area, property_type, bhk, bedrooms, bathrooms, area_sqft, price, deposit, maintenance, furnishing, floor, total_floors, property_age, state, pincode, landmark, amenities, images, status, rejection_reason, change_request_note, submitted_at, created_at FROM properties WHERE owner_id = ? ORDER BY created_at DESC`).all(req.owner.id);
  res.json({ properties: rows.map(parseProperty) });
});

function parseProperty(row) {
  return { ...row, amenities: parseJson(row.amenities), images: parseJson(row.images) };
}
function parseJson(value) {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

// POST /api/owner/properties - owner creates a property for admin approval
router.post('/', (req, res) => {
  const b = req.body || {};
  const required = ['title', 'description', 'propertyType', 'price', 'state', 'city', 'area', 'pincode'];
  const missing = required.filter((key) => !String(b[key] ?? '').trim());
  if (missing.length) return res.status(400).json({ error: `Please fill: ${missing.join(', ')}` });

  const images = Array.isArray(b.images) ? b.images.map(String).map(s => s.trim()).filter(Boolean).slice(0, 12) : [];
  const amenities = Array.isArray(b.amenities) ? b.amenities.map(String).map(s => s.trim()).filter(Boolean).slice(0, 30) : [];
  if (!images.length) return res.status(400).json({ error: 'Please add at least one property image URL.' });

  const result = db.prepare(`INSERT INTO properties (owner_id, title, description, property_type, bhk, bedrooms, bathrooms, area_sqft, price, deposit, maintenance, furnishing, floor, total_floors, property_age, state, city, area, pincode, landmark, latitude, longitude, amenities, images, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(
    req.owner.id, String(b.title).trim(), String(b.description).trim(), String(b.propertyType).trim(), String(b.bhk || '').trim() || null, numberOrNull(b.bedrooms), numberOrNull(b.bathrooms), numberOrNull(b.areaSqft), numberOrNull(b.price), numberOrNull(b.deposit), numberOrNull(b.maintenance), String(b.furnishing || '').trim() || null, String(b.floor || '').trim() || null, numberOrNull(b.totalFloors), String(b.propertyAge || '').trim() || null, String(b.state).trim(), String(b.city).trim(), String(b.area).trim(), String(b.pincode).trim(), String(b.landmark || '').trim() || null, numberOrNull(b.latitude), numberOrNull(b.longitude), JSON.stringify(amenities), JSON.stringify(images)
  );

  res.status(201).json({ message: 'Property submitted for admin approval.', propertyId: result.lastInsertRowid });
});

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

module.exports = router;
