const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ind_homes_secret_jwt_key_default_development_2026';

// Generic factory: builds a middleware that checks a role-specific cookie
// (or Authorization: Bearer header as a fallback) and attaches the decoded
// payload to req[reqKey].
function requireRole(role, cookieName, reqKey) {
  return function (req, res, next) {
    const token =
      (req.cookies && req.cookies[cookieName]) ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role !== role) {
        return res.status(403).json({ error: `${role} access required.` });
      }
      req[reqKey] = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
  };
}

const requireAdmin = requireRole('admin', 'admin_token', 'admin');
const requireOwner = requireRole('owner', 'owner_token', 'owner');
const requireUser = requireRole('user', 'user_token', 'user');

// Optional user authentication. Unlike requireUser, this never rejects an
// anonymous visitor; it only attaches req.user when a valid user session exists.
// Used by public property endpoints so private owner contact fields are only
// returned to logged-in users.
function optionalUser(req, res, next) {
  const token =
    (req.cookies && req.cookies.user_token) ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'user') req.user = payload;
  } catch (err) {
    // Treat an invalid/expired optional user session as anonymous.
  }
  next();
}

module.exports = { requireAdmin, requireOwner, requireUser, optionalUser };
