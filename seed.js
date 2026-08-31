require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

function upsertAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@indhomes.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const existing = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)').run(email, hash, 'Administrator');
  console.log(`Created admin account: ${email} / ${password}  (CHANGE THIS PASSWORD AFTER FIRST LOGIN)`);
}

function seedSampleData() {
  const ownerCount = db.prepare('SELECT COUNT(*) c FROM owners').get().c;
  if (ownerCount > 0) {
    console.log('Sample data already present, skipping.');
    return;
  }

  const ownerPwd = bcrypt.hashSync('Owner@123', 10);
  const userPwd = bcrypt.hashSync('User@123', 10);

  const insertOwner = db.prepare(
    'INSERT INTO owners (name, email, mobile, password_hash, owner_type, verification_status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const owner1 = insertOwner.run('Ravi Kumar', 'ravi.kumar@example.com', '9876543210', ownerPwd, 'Individual', 'VERIFIED');
  const owner2 = insertOwner.run('Priya Realty Pvt Ltd', 'contact@priyarealty.example.com', '9876500000', ownerPwd, 'Agency', 'UNVERIFIED');

  const insertUser = db.prepare('INSERT INTO users (name, email, mobile, city, password_hash) VALUES (?, ?, ?, ?, ?)');
  const user1 = insertUser.run('Anita Sharma', 'anita.sharma@example.com', '9123456780', 'Hyderabad', userPwd);
  const user2 = insertUser.run('Karthik Reddy', 'karthik.reddy@example.com', '9123456781', 'Hyderabad', userPwd);

  const insertProperty = db.prepare(`
    INSERT INTO properties
      (owner_id, title, description, property_type, bhk, bedrooms, bathrooms, area_sqft, price, deposit,
       maintenance, furnishing, floor, total_floors, property_age, state, city, area, pincode, landmark,
       latitude, longitude, amenities, images, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const p1 = insertProperty.run(
    owner1.lastInsertRowid, 'Green Valley Residency', '2 BHK apartment close to IT hub.', 'Apartment', '2 BHK',
    2, 2, 1100, 28000, 56000, 2500, 'Semi-Furnished', '4', 12, '2 years', 'Telangana', 'Hyderabad', 'Kondapur',
    '500084', 'Near Botanical Garden', 17.4486, 78.3908,
    JSON.stringify(['Parking', 'Lift', 'Security', 'CCTV', 'Power Backup']),
    JSON.stringify(['https://picsum.photos/seed/prop1a/800/600', 'https://picsum.photos/seed/prop1b/800/600']),
    'PENDING_APPROVAL'
  );

  const p2 = insertProperty.run(
    owner2.lastInsertRowid, 'Sunrise Enclave 3BHK', 'Spacious family apartment with clubhouse access.', 'Apartment',
    '3 BHK', 3, 3, 1650, 45000, 90000, 3500, 'Fully-Furnished', '7', 15, '1 year', 'Telangana', 'Hyderabad',
    'Gachibowli', '500032', 'Near Financial District', 17.4239, 78.3428,
    JSON.stringify(['Parking', 'Lift', 'Gym', 'Swimming Pool', 'Clubhouse', 'CCTV']),
    JSON.stringify(['https://picsum.photos/seed/prop2a/800/600']),
    'APPROVED'
  );

  const p3 = insertProperty.run(
    owner1.lastInsertRowid, 'Budget 1BHK near Metro', 'Compact and affordable, walkable to metro station.',
    'Apartment', '1 BHK', 1, 1, 550, 14000, 28000, 1200, 'Unfurnished', '2', 6, '5 years', 'Telangana',
    'Hyderabad', 'Ameerpet', '500016', 'Near Metro Station', 17.4374, 78.4487,
    JSON.stringify(['Parking', 'Water Supply']),
    JSON.stringify(['https://picsum.photos/seed/prop3a/800/600']),
    'REJECTED'
  );
  db.prepare("UPDATE properties SET rejection_reason = ? WHERE id = ?").run(
    'Please upload clearer property images and update the property location.', p3.lastInsertRowid
  );

  db.prepare(
    `INSERT INTO contact_requests (user_id, property_id, owner_id, request_type, status, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user1.lastInsertRowid, p2.lastInsertRowid, owner2.lastInsertRowid, 'Contact Owner', 'PENDING', 'Interested in a quick call.');

  db.prepare(
    `INSERT INTO contact_requests (user_id, property_id, owner_id, request_type, status, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user2.lastInsertRowid, p2.lastInsertRowid, owner2.lastInsertRowid, 'Schedule Visit', 'CONTACTED', 'Would like to visit this weekend.');

  db.prepare(
    `INSERT INTO notifications (audience, type, title, message, link) VALUES ('ADMIN', ?, ?, ?, ?)`
  ).run(
    'NEW_PROPERTY_SUBMITTED',
    'New Property Approval Request',
    'Owner Ravi Kumar submitted a 2 BHK apartment in Kondapur, Hyderabad.',
    `/properties/${p1.lastInsertRowid}`
  );

  console.log('Sample data seeded: 2 owners, 2 users, 3 properties, 2 contact requests.');
}

upsertAdmin();
seedSampleData();
console.log('Seeding complete.');
