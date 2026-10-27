require('dotenv').config();

// Ensure session and security token secrets are always initialized
process.env.JWT_SECRET = process.env.JWT_SECRET || 'indhomes_jwt_secret_render_production_key_2026';
process.env.RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET || 'indhomes_reset_token_render_secret_key_2026';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require('./routes/contactRoutes');
const activityRoutes = require('./routes/activityRoutes');
const ownerAuthRoutes = require('./routes/ownerAuthRoutes');
const userAuthRoutes = require('./routes/userAuthRoutes');
const ownerPropertyRoutes = require('./routes/ownerPropertyRoutes');
const userRequestRoutes = require('./routes/userRequestRoutes');
const publicPropertyRoutes = require('./routes/publicPropertyRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Automatically ensure admin accounts and seed properties exist on boot
try {
  const { runSeed } = require('./seed');
  runSeed().catch((err) => {
    console.error('Database bootstrap warning:', err.message);
  });
} catch (err) {
  console.error('Database bootstrap error:', err.message);
}

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

// Public IND Homes website. Admin login remains at /admin-login.html.
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Explicit uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'frontend', 'uploads')));

// Public property API. Anonymous visitors see owner name only;
// authenticated users also receive owner email/mobile.
app.use('/api/properties', publicPropertyRoutes);

app.use('/api/upload', uploadRoutes);
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/properties', propertyRoutes);
app.use('/api/admin/owners', ownerRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/contact-requests', contactRoutes);
app.use('/api/admin/activity-logs', activityRoutes);
app.use('/api/owner/auth', ownerAuthRoutes);
app.use('/api/user/auth', userAuthRoutes);
app.use('/api/owner/properties', ownerPropertyRoutes);
app.use('/api/user/requests', userRequestRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`IND Homes API running on port ${PORT}`);
});
