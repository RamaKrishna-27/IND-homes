require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function upsertAdmin() {
  const defaultAdmins = [
    { email: 'harshavardhanmamidi89@gmail.com', password: 'prk@2007', name: 'Harshavardhan Mamidi' },
    { email: 'ramakrishnapuvvala3@gmail.com', password: 'prk@2007', name: 'Rama Krishna' },
    { email: 'admin@indhomes.com', password: 'prk@2007', name: 'Administrator' }
  ];

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    defaultAdmins.unshift({
      email: process.env.ADMIN_EMAIL.toLowerCase().trim(),
      password: process.env.ADMIN_PASSWORD,
      name: 'System Admin'
    });
  }

  for (const admin of defaultAdmins) {
    const normalizedEmail = admin.email.toLowerCase().trim();
    const hash = bcrypt.hashSync(admin.password, 12);
    const existing = await db.prepare('SELECT * FROM admins WHERE email = ?').get(normalizedEmail);
    if (existing) {
      await db.prepare('UPDATE admins SET password_hash = ?, name = ? WHERE id = ?').run(hash, admin.name, existing.id);
      console.log(`Admin account verified/updated: ${normalizedEmail}`);
    } else {
      await db.prepare('INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)').run(normalizedEmail, hash, admin.name);
      console.log(`Created admin account: ${normalizedEmail}`);
    }
  }
}

async function seedSampleData() {
  const ownerCountRow = await db.prepare('SELECT COUNT(*) as c FROM owners').get();
  const ownerCount = Number(ownerCountRow?.c || 0);
  if (ownerCount > 0) {
    console.log('Sample owners already present, skipping full re-seed.');
    return;
  }

  const ownerPwd = bcrypt.hashSync('Owner@123', 10);
  const userPwd = bcrypt.hashSync('User@123', 10);

  const insertOwner = db.prepare(
    'INSERT INTO owners (name, email, mobile, password_hash, owner_type, verification_status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const owner1 = await insertOwner.run('Ravi Kumar Varma', 'ravi.kumar@example.com', '+91 98765 43210', ownerPwd, 'Individual', 'VERIFIED');
  const owner2 = await insertOwner.run('Priya Realty & Infrastructure', 'contact@priyarealty.example.com', '+91 98765 00000', ownerPwd, 'Agency', 'VERIFIED');
  const owner3 = await insertOwner.run('Suresh Reddy', 'suresh.reddy@example.com', '+91 94401 23456', ownerPwd, 'Individual', 'VERIFIED');
  const owner4 = await insertOwner.run('Lakshmi Estates & Builders', 'info@lakshmiestates.example.com', '+91 91234 56789', ownerPwd, 'Agency', 'UNVERIFIED');

  const insertUser = db.prepare('INSERT INTO users (name, email, mobile, city, password_hash) VALUES (?, ?, ?, ?, ?)');
  const user1 = await insertUser.run('Anita Sharma', 'anita.sharma@example.com', '+91 91234 56780', 'Hyderabad', userPwd);
  const user2 = await insertUser.run('Karthik Reddy', 'karthik.reddy@example.com', '+91 91234 56781', 'Bengaluru', userPwd);
  const user3 = await insertUser.run('Pooja Patel', 'pooja.patel@example.com', '+91 98220 11223', 'Mumbai', userPwd);

  const insertProperty = db.prepare(`
    INSERT INTO properties
      (owner_id, title, description, property_type, bhk, bedrooms, bathrooms, area_sqft, price, deposit,
       maintenance, furnishing, floor, total_floors, property_age, state, city, area, pincode, landmark,
       latitude, longitude, amenities, images, status, submitted_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  // --- 1. Hyderabad, Telangana ---
  const p1 = await insertProperty.run(
    owner1.lastInsertRowid,
    'My Home Bhooja Luxury 3 BHK',
    'Ultra-luxury 3 BHK high-rise apartment in HITEC City with panoramic city view, Italian marble flooring, and smart home automation.',
    'Apartment', '3 BHK', 3, 3, 2150, 68000, 136000, 4500, 'Fully-Furnished', '18', 36, '1 year',
    'Telangana', 'Hyderabad', 'HITEC City', '500081', 'Near Cyber Towers & Knowledge City', 17.4435, 78.3772,
    JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Covered Parking', 'Lift', '24/7 Security', 'Power Backup', 'EV Charging']),
    JSON.stringify(['images/properties/prop1_bhooja_1.jpg', 'images/properties/prop1_bhooja_2.jpg']),
    'APPROVED'
  );

  const p2 = await insertProperty.run(
    owner1.lastInsertRowid,
    'Green Valley Residency 2 BHK',
    'Well-ventilated 2 BHK apartment close to Botanical Garden and Kondapur IT corridor. Gated community with 24-hr security.',
    'Apartment', '2 BHK', 2, 2, 1150, 28000, 56000, 2500, 'Semi-Furnished', '4', 10, '2 years',
    'Telangana', 'Hyderabad', 'Kondapur', '500084', 'Near Botanical Garden', 17.4649, 78.3610,
    JSON.stringify(['Parking', 'Lift', 'Security', 'CCTV', 'Power Backup', 'Children Play Area']),
    JSON.stringify(['images/properties/prop2_greenvalley_1.jpg']),
    'PENDING_APPROVAL'
  );

  const p3 = await insertProperty.run(
    owner2.lastInsertRowid,
    'Aparna Serene Park 3 BHK',
    'Spacious 3 BHK apartment in Gachibowli near Financial District with world-class clubhouse, tennis court, and lush green landscaping.',
    'Apartment', '3 BHK', 3, 3, 1720, 48000, 96000, 3500, 'Semi-Furnished', '7', 15, '1 year',
    'Telangana', 'Hyderabad', 'Gachibowli', '500032', 'Near Financial District & Wipro Circle', 17.4399, 78.3489,
    JSON.stringify(['Swimming Pool', 'Gym', 'Clubhouse', 'Jogging Track', 'Tennis Court', 'Intercom', 'Power Backup']),
    JSON.stringify(['images/properties/prop3_aparna_1.jpg', 'images/properties/prop3_aparna_2.jpg']),
    'APPROVED'
  );

  const p4 = await insertProperty.run(
    owner3.lastInsertRowid,
    'Budget 1 BHK near Ameerpet Metro',
    'Compact, budget-friendly 1 BHK home within 200m of Ameerpet Metro Interchange. Ideal for working professionals and students.',
    'Apartment', '1 BHK', 1, 1, 550, 14000, 28000, 1000, 'Unfurnished', '2', 5, '4 years',
    'Telangana', 'Hyderabad', 'Ameerpet', '500016', 'Behind Metro Station', 17.4374, 78.4487,
    JSON.stringify(['24/7 Water Supply', 'Bike Parking', 'CCTV']),
    JSON.stringify(['images/properties/prop4_ameerpet_1.jpg']),
    'APPROVED'
  );

  // --- 2. Bengaluru, Karnataka ---
  const p5 = await insertProperty.run(
    owner2.lastInsertRowid,
    'Prestige Falcon City 3 BHK',
    'Premium 3 BHK apartment on Kanakapura Road, Bangalore with metro connectivity at the doorstep and Forum South Mall within complex.',
    'Apartment', '3 BHK', 3, 3, 1580, 52000, 150000, 4000, 'Fully-Furnished', '11', 28, '2 years',
    'Karnataka', 'Bengaluru', 'Kanakapura Road', '560062', 'Adjacent to Doddakallasandra Metro Station', 12.8876, 77.5518,
    JSON.stringify(['Clubhouse', 'Swimming Pool', 'Badminton Court', 'Squash Court', 'Multiplex', 'Gym', '24/7 Security']),
    JSON.stringify(['images/properties/prop5_prestige_1.jpg', 'images/properties/prop5_prestige_2.jpg']),
    'APPROVED'
  );

  const p6 = await insertProperty.run(
    owner1.lastInsertRowid,
    'Sobha Dream Acres 2 BHK',
    'Modern 2 BHK apartment in Panathur, Whitefield ORR. Close to Cessna Business Park, Prestige Tech Park, and international schools.',
    'Apartment', '2 BHK', 2, 2, 1050, 36000, 100000, 3000, 'Semi-Furnished', '9', 14, '3 years',
    'Karnataka', 'Bengaluru', 'Whitefield', '560087', 'Near Panathur Main Road', 12.9382, 77.7126,
    JSON.stringify(['Gym', 'Swimming Pool', 'Covered Car Parking', 'Security', 'Rainwater Harvesting']),
    JSON.stringify(['images/properties/prop6_sobha_1.jpg']),
    'PENDING_APPROVAL'
  );

  // --- 3. Mumbai & Pune, Maharashtra ---
  const p7 = await insertProperty.run(
    owner2.lastInsertRowid,
    'Lodha Park Luxury Sea-View 2 BHK',
    'Exclusive 2 BHK sea-view apartment in Worli, South Mumbai. Features private rooftop terrace access, concierge service, and 7-acre private park.',
    'Apartment', '2 BHK', 2, 2, 1100, 125000, 350000, 8000, 'Fully-Furnished', '32', 75, '1 year',
    'Maharashtra', 'Mumbai', 'Worli', '400018', 'Near Bandra-Worli Sea Link', 19.0022, 72.8182,
    JSON.stringify(['Sea View', 'Private Park', 'Infinity Pool', 'Concierge Service', 'High-Speed Elevators', 'Valet Parking']),
    JSON.stringify(['images/properties/prop7_lodha_1.jpg', 'images/properties/prop7_lodha_2.jpg']),
    'APPROVED'
  );

  const p8 = await insertProperty.run(
    owner3.lastInsertRowid,
    'Amanora Gold Towers 2 BHK',
    'Well-designed 2 BHK inside Amanora Park Town, Hadapsar, Pune. Walkable to Amanora Mall and Magarpatta Cybercity.',
    'Apartment', '2 BHK', 2, 2, 980, 30000, 75000, 2200, 'Semi-Furnished', '14', 32, '2 years',
    'Maharashtra', 'Pune', 'Hadapsar', '411028', 'Inside Amanora Township', 18.5186, 73.9352,
    JSON.stringify(['Township Amenities', 'Gym', 'Swimming Pool', 'Security', 'Clubhouse', 'Children Play Area']),
    JSON.stringify(['images/properties/prop8_amanora_1.jpg']),
    'APPROVED'
  );

  // --- 4. Chennai, Tamil Nadu ---
  const p9 = await insertProperty.run(
    owner4.lastInsertRowid,
    'Olympia Opaline 3 BHK OMR',
    'Waterfront 3 BHK apartment in Navalur along the Rajiv Gandhi IT Expressway (OMR), Chennai with sea breeze and full amenities.',
    'Apartment', '3 BHK', 3, 3, 1420, 32000, 80000, 2800, 'Semi-Furnished', '8', 19, '3 years',
    'Tamil Nadu', 'Chennai', 'Navalur, OMR', '603103', 'Near Vivira Mall', 12.8465, 80.2285,
    JSON.stringify(['Clubhouse', 'Gym', 'Power Backup', 'Lift', 'Covered Parking', 'Security']),
    JSON.stringify(['images/properties/prop9_olympia_1.jpg']),
    'APPROVED'
  );

  // --- 5. Andhra Pradesh (Visakhapatnam & Vijayawada) ---
  const p10 = await insertProperty.run(
    owner1.lastInsertRowid,
    'Royal Palm Beachfront Villa 4 BHK',
    'Spectacular 4 BHK independent duplex villa overlooking Rushikonda Beach, Vizag with private landscaped garden and car porch.',
    'Villa', '4 BHK', 4, 4, 3200, 75000, 200000, 5000, 'Fully-Furnished', 'Ground + 1', 2, 'New',
    'Andhra Pradesh', 'Visakhapatnam', 'Rushikonda', '530045', 'Near IT SEZ & Rushikonda Beach', 17.7818, 83.3855,
    JSON.stringify(['Private Garden', 'Sea View', 'Car Porch', 'Modular Kitchen', 'Solar Power Backup', 'CCTV Security']),
    JSON.stringify(['images/properties/prop10_rushikonda_1.jpg', 'images/properties/prop10_rushikonda_2.jpg']),
    'APPROVED'
  );

  const p11 = await insertProperty.run(
    owner3.lastInsertRowid,
    'Capital Heights 3 BHK',
    'Prime 3 BHK apartment near Benz Circle, Vijayawada with modern kitchen, spacious balconies, and covered car parking.',
    'Apartment', '3 BHK', 3, 3, 1600, 35000, 80000, 2500, 'Semi-Furnished', '5', 8, '2 years',
    'Andhra Pradesh', 'Vijayawada', 'Benz Circle', '520010', 'Near PVP Square Mall', 16.5012, 80.6437,
    JSON.stringify(['Lift', 'Covered Parking', '24/7 Generator Backup', 'Security Guard', 'Municipal Water']),
    JSON.stringify(['images/properties/prop11_capital_1.jpg']),
    'APPROVED'
  );

  // --- 6. Delhi NCR / Gurgaon ---
  const p12 = await insertProperty.run(
    owner2.lastInsertRowid,
    'DLF The Ultima Premium 3 BHK',
    'Spacious 3 BHK residence in Sector 81, Gurgaon with expansive balconies, modern fittings, and lush greenery.',
    'Apartment', '3 BHK', 3, 3, 2100, 58000, 120000, 4500, 'Semi-Furnished', '12', 29, '2 years',
    'Haryana', 'Gurgaon', 'Sector 81', '122004', 'Near Dwarka Expressway & NH-48', 28.3789, 76.9452,
    JSON.stringify(['Clubhouse', 'Olympic Size Pool', 'Gym', 'Tennis & Badminton Courts', '24/7 Security']),
    JSON.stringify(['images/properties/prop12_dlf_1.jpg', 'images/properties/prop12_dlf_2.jpg']),
    'APPROVED'
  );

  // Rejection sample for testing workflow
  const p13 = await insertProperty.run(
    owner4.lastInsertRowid,
    'Commercial Office Space in Madhapur',
    'Furnished 80-seater office space near Image Hospitals, Madhapur.',
    'Commercial', null, null, 2, 3500, 180000, 540000, 15000, 'Fully-Furnished', '3', 6, '5 years',
    'Telangana', 'Hyderabad', 'Madhapur', '500081', 'Near Image Hospitals', 17.4483, 78.3915,
    JSON.stringify(['Central AC', 'High-Speed Elevators', 'Cafeteria', 'Visitor Parking']),
    JSON.stringify(['images/properties/prop13_office_1.jpg']),
    'REJECTED'
  );
  await db.prepare("UPDATE properties SET rejection_reason = ? WHERE id = ?").run(
    'Commercial floor plan and fire clearance certificate need to be attached.', p13.lastInsertRowid
  );

  // Contact requests
  await db.prepare(
    `INSERT INTO contact_requests (user_id, property_id, owner_id, request_type, status, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user1.lastInsertRowid, p1.lastInsertRowid, owner1.lastInsertRowid, 'Contact Owner', 'PENDING', 'Interested in viewing this 3 BHK in HITEC City this Saturday.');

  await db.prepare(
    `INSERT INTO contact_requests (user_id, property_id, owner_id, request_type, status, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user2.lastInsertRowid, p5.lastInsertRowid, owner2.lastInsertRowid, 'Schedule Visit', 'CONTACTED', 'Looking for immediate move-in for my family in Bengaluru.');

  await db.prepare(
    `INSERT INTO contact_requests (user_id, property_id, owner_id, request_type, status, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user3.lastInsertRowid, p7.lastInsertRowid, owner2.lastInsertRowid, 'Contact Owner', 'RESPONDED', 'Requested video walkthrough of the sea view.');

  // Notifications
  await db.prepare(
    `INSERT INTO notifications (audience, type, title, message, link) VALUES ('ADMIN', ?, ?, ?, ?)`
  ).run(
    'NEW_PROPERTY_SUBMITTED',
    'New Property Approval Request',
    'Owner Ravi Kumar submitted "Green Valley Residency 2 BHK" in Kondapur, Hyderabad.',
    `/properties/${p2.lastInsertRowid}`
  );

  await db.prepare(
    `INSERT INTO notifications (audience, type, title, message, link) VALUES ('ADMIN', ?, ?, ?, ?)`
  ).run(
    'NEW_PROPERTY_SUBMITTED',
    'New Property Approval Request',
    'Owner Ravi Kumar submitted "Sobha Dream Acres 2 BHK" in Whitefield, Bengaluru.',
    `/properties/${p6.lastInsertRowid}`
  );

  console.log('Sample data seeded: 4 owners, 3 users, 13 properties across India, 3 contact requests.');
}

async function runSeed() {
  await upsertAdmin();
  await seedSampleData();
  console.log('IND Homes database verified and ready.');
}

if (require.main === module) {
  runSeed().catch(console.error);
}

module.exports = { runSeed, upsertAdmin, seedSampleData };

