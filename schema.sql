-- IND Homes Admin System Schema

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT 'Administrator',
  reset_token_hash TEXT,
  reset_token_expires INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT,
  password_hash TEXT NOT NULL,
  owner_type TEXT DEFAULT 'Individual',
  verification_status TEXT DEFAULT 'UNVERIFIED', -- UNVERIFIED, VERIFIED
  account_status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DELETED
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT,
  city TEXT,
  password_hash TEXT NOT NULL,
  account_status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DELETED
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES owners(id),
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT,
  bhk TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft REAL,
  price REAL,
  deposit REAL,
  maintenance REAL,
  furnishing TEXT,
  floor TEXT,
  total_floors INTEGER,
  property_age TEXT,
  state TEXT,
  city TEXT,
  area TEXT,
  pincode TEXT,
  landmark TEXT,
  latitude REAL,
  longitude REAL,
  amenities TEXT, -- JSON array stored as text
  images TEXT,    -- JSON array of image URLs stored as text
  status TEXT DEFAULT 'DRAFT', -- DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CHANGES_REQUESTED, SUSPENDED, DELETED
  rejection_reason TEXT,
  change_request_note TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  property_id INTEGER NOT NULL REFERENCES properties(id),
  owner_id INTEGER NOT NULL REFERENCES owners(id),
  request_type TEXT DEFAULT 'Contact Owner', -- Contact Owner, Schedule Visit, General Enquiry
  status TEXT DEFAULT 'PENDING', -- PENDING, CONTACTED, RESPONDED, CLOSED, CANCELLED
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reported_properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  reported_by_user_id INTEGER REFERENCES users(id),
  reason TEXT,
  status TEXT DEFAULT 'OPEN', -- OPEN, REVIEWED, DISMISSED
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience TEXT NOT NULL, -- 'ADMIN' or 'OWNER'
  owner_id INTEGER REFERENCES owners(id), -- set when audience = OWNER
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER REFERENCES admins(id),
  admin_email TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
