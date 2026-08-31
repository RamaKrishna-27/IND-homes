const crypto = require('crypto');

// Generates a secure random token to email to the user, plus a hash of it to store in the DB.
// We never store the raw token - only its hash - so a DB leak alone can't be used to reset passwords.
function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
  return { rawToken, tokenHash, expiresAt };
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = { generateResetToken, hashToken };
