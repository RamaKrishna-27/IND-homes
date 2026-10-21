// Centralized Supabase Client Connector for IND Homes
// Supports @supabase/supabase-js with environment variables or fallback configuration.
require('dotenv').config();
let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  createClient = null;
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  'https://hryoiexamaruvujcmbmz.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

let supabase = null;

if (createClient && SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[Supabase Client] Initialized successfully for URL:', SUPABASE_URL);
  } catch (err) {
    console.warn('[Supabase Client] Initialization error:', err.message);
  }
} else {
  console.log('[Supabase Client] Direct PostgreSQL pooler active via config/db.js.');
}

module.exports = {
  supabase,
  SUPABASE_URL,
  isConfigured: Boolean(supabase)
};
