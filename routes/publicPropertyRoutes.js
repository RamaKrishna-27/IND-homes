const express = require('express');
const db = require('../config/db');
const { optionalUser } = require('../middleware/auth');

const router = express.Router();
router.use(optionalUser);


// GET /api/properties
function safeParseJson(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      if (value.includes(',')) {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [value];
    }
  }
  return fallback;
}

// Anonymous visitors receive owner name only.
// Logged-in users also receive owner mobile + email.
router.get('/', async (req, res) => {
  try {
    const { city, type, search } = req.query;
    let sql = `
      SELECT p.*, o.name AS owner_name
        ${req.user ? ', o.email AS owner_email, o.mobile AS owner_mobile' : ''}
      FROM properties p
      JOIN owners o ON o.id = p.owner_id
      WHERE p.status = 'APPROVED'
    `;
    const params = [];

    if (city) {
      sql += ' AND LOWER(p.city) LIKE LOWER(?)';
      params.push(`%${city}%`);
    }
    if (type && type !== 'All') {
      sql += ' AND p.property_type = ?';
      params.push(type);
    }
    if (search) {
      sql += ' AND (LOWER(p.title) LIKE LOWER(?) OR LOWER(p.city) LIKE LOWER(?) OR LOWER(p.area) LIKE LOWER(?))';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.created_at DESC';

    const rows = await db.prepare(sql).all(...params);
    res.json({
      authenticated: Boolean(req.user),
      properties: (rows || []).map((p) => {
        const property = serializePublicPropertyBase(p);
        if (req.user) {
          property.owner.email = p.owner_email || null;
          property.owner.mobile = p.owner_mobile || null;
        }
        return property;
      })
    });
  } catch (err) {
    console.error('[Public Properties Error]', err);
    res.status(500).json({ error: 'Failed to load properties. ' + err.message, properties: [] });
  }
});

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  try {
    const p = await db.prepare(`
      SELECT p.*, o.name AS owner_name
        ${req.user ? ', o.email AS owner_email, o.mobile AS owner_mobile' : ''}
      FROM properties p
      JOIN owners o ON o.id = p.owner_id
      WHERE p.id = ? AND p.status = 'APPROVED'
    `).get(req.params.id);

    if (!p) return res.status(404).json({ error: 'Approved property not found.' });

    const property = serializePublicPropertyBase(p);
    if (req.user) {
      property.owner.email = p.owner_email || null;
      property.owner.mobile = p.owner_mobile || null;
    }

    res.json({ authenticated: Boolean(req.user), property });
  } catch (err) {
    console.error('[Public Property Details Error]', err);
    res.status(500).json({ error: 'Failed to load property details. ' + err.message });
  }
});

function serializePublicPropertyBase(p) {
  return {
    id: p.id,
    title: p.title || 'Untitled Property',
    description: p.description || '',
    property_type: p.property_type || 'Apartment',
    bhk: p.bhk || '',
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    area_sqft: p.area_sqft,
    price: p.price || 0,
    deposit: p.deposit || 0,
    maintenance: p.maintenance || 0,
    furnishing: p.furnishing || '',
    floor: p.floor || '',
    total_floors: p.total_floors,
    property_age: p.property_age || '',
    state: p.state || '',
    city: p.city || '',
    area: p.area || '',
    pincode: p.pincode || '',
    landmark: p.landmark || '',
    latitude: p.latitude,
    longitude: p.longitude,
    images: safeParseJson(p.images, ['images/properties/placeholder.jpg']),
    amenities: safeParseJson(p.amenities, []),
    owner: { name: p.owner_name || 'Verified Owner' }
  };
}

module.exports = router;
