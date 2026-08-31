const express = require('express');
const db = require('../config/db');
const { optionalUser } = require('../middleware/auth');

const router = express.Router();
router.use(optionalUser);


// GET /api/properties
// Anonymous visitors receive owner name only.
// Logged-in users also receive owner mobile + email.
router.get('/', (req, res) => {
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
    sql += ' AND p.city LIKE ?';
    params.push(`%${city}%`);
  }
  if (type && type !== 'All') {
    sql += ' AND p.property_type = ?';
    params.push(type);
  }
  if (search) {
    sql += ' AND (p.title LIKE ? OR p.city LIKE ? OR p.area LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY p.created_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({
    authenticated: Boolean(req.user),
    properties: rows.map((p) => {
      const property = serializePublicPropertyBase(p);
      if (req.user) {
        property.owner.email = p.owner_email;
        property.owner.mobile = p.owner_mobile;
      }
      return property;
    })
  });
});

// GET /api/properties/:id
router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, o.name AS owner_name
      ${req.user ? ', o.email AS owner_email, o.mobile AS owner_mobile' : ''}
    FROM properties p
    JOIN owners o ON o.id = p.owner_id
    WHERE p.id = ? AND p.status = 'APPROVED'
  `).get(req.params.id);

  if (!p) return res.status(404).json({ error: 'Approved property not found.' });

  const property = serializePublicPropertyBase(p);
  if (req.user) {
    property.owner.email = p.owner_email;
    property.owner.mobile = p.owner_mobile;
  }

  res.json({ authenticated: Boolean(req.user), property });
});

function serializePublicPropertyBase(p) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    property_type: p.property_type,
    bhk: p.bhk,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    area_sqft: p.area_sqft,
    price: p.price,
    deposit: p.deposit,
    maintenance: p.maintenance,
    furnishing: p.furnishing,
    floor: p.floor,
    total_floors: p.total_floors,
    property_age: p.property_age,
    state: p.state,
    city: p.city,
    area: p.area,
    pincode: p.pincode,
    landmark: p.landmark,
    latitude: p.latitude,
    longitude: p.longitude,
    images: p.images ? JSON.parse(p.images) : [],
    amenities: p.amenities ? JSON.parse(p.amenities) : [],
    owner: { name: p.owner_name }
  };
}

module.exports = router;
