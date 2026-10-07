-- IND Homes - Supabase (PostgreSQL) Database Schema

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT 'Administrator',
  reset_token_hash TEXT,
  reset_token_expires BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Owners Table
CREATE TABLE IF NOT EXISTS owners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT,
  password_hash TEXT NOT NULL,
  owner_type TEXT DEFAULT 'Individual',
  verification_status TEXT DEFAULT 'UNVERIFIED',
  account_status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT,
  city TEXT,
  password_hash TEXT NOT NULL,
  account_status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Properties Table
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT,
  bhk TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft NUMERIC,
  price NUMERIC,
  deposit NUMERIC,
  maintenance NUMERIC,
  furnishing TEXT,
  floor TEXT,
  total_floors INTEGER,
  property_age TEXT,
  state TEXT,
  city TEXT,
  area TEXT,
  pincode TEXT,
  landmark TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  amenities TEXT,
  images TEXT,
  status TEXT DEFAULT 'DRAFT',
  rejection_reason TEXT,
  change_request_note TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Contact Requests Table
CREATE TABLE IF NOT EXISTS contact_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  request_type TEXT DEFAULT 'Contact Owner',
  status TEXT DEFAULT 'PENDING',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Reported Properties Table
CREATE TABLE IF NOT EXISTS reported_properties (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reported_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  audience TEXT NOT NULL,
  owner_id INTEGER REFERENCES owners(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_user_id ON contact_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_owner_id ON contact_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience, is_read);
