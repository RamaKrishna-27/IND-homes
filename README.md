# IND Homes — Admin Account, Property Approval & Management System

A working full-stack implementation of the admin portal spec: secure admin login,
dashboard stats, the owner → pending → admin review → approve/reject/request-changes
workflow, owner/user management, contact request monitoring, admin notifications,
activity logging, and secure password reset.

```
├── config/       Database configuration and connection (SQLite)
├── middleware/   Authentication & role authorization middleware
├── routes/       Express REST API route controllers
├── utils/        Logging, notifications, mailer, token utilities
├── frontend/     Static HTML/CSS/JS frontend (no build step)
├── schema.sql    SQLite database schema
├── seed.js       Bootstrap admin account & sample data
├── server.js     Main Express server entrypoint
└── package.json  Dependencies and start scripts
```

## Quick Start (Local)

```bash
npm install
cp .env.example .env
npm start
```

This will automatically seed the default admin account + sample data on first run and start the server on `http://localhost:5000`.

- Public Portal: `http://localhost:5000/`
- Admin Login: `http://localhost:5000/admin-login.html` (Email: `admin@indhomes.com`, Password: `ChangeMe123!`)
- Owner Portal: `http://localhost:5000/owner-login.html`
- User Portal: `http://localhost:5000/user-login.html`

## Deploying on Render

1. Connect your GitHub repository to Render as a **Web Service**.
2. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. (Optional) Set Environment Variables:
   - `JWT_SECRET`: A long random string
   - `RESET_TOKEN_SECRET`: A long random string
   - `ADMIN_EMAIL`: Your preferred admin email
   - `ADMIN_PASSWORD`: Your preferred initial admin password

## 2. Frontend setup

The frontend is static HTML/CSS/JS — no build step. Serve it with any static file server, e.g.:

```bash
cd frontend
npx serve -l 8080
# or: python3 -m http.server 8080
```

Open `http://localhost:8080`. If your backend runs somewhere other than
`http://localhost:5000`, update `API_BASE` at the top of `frontend/js/api.js`.

Three separate login areas, all served from the same frontend:

| Portal | Login page | Register page | After login |
|---|---|---|---|
| Public | `index.html` | — | Property browsing / details |
| Admin | `admin-login.html` | — (one seeded via `npm run seed`) | `dashboard.html` |
| Owner | `owner-login.html` | `owner-register.html` | `owner-dashboard.html` |
| User  | `user-login.html`  | `user-register.html`  | `user-dashboard.html` |

Admin: log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.

Owner/User: either register a fresh account from the register pages, or use
the seeded sample accounts (created by `npm run seed`):
- Owners: `ravi.kumar@example.com` / `Owner@123`, `contact@priyarealty.example.com` / `Owner@123`
- Users: `anita.sharma@example.com` / `User@123`, `karthik.reddy@example.com` / `User@123`

## 3. What's implemented

- **Admin auth**: login, logout, session via JWT (httpOnly cookie + Bearer fallback),
  rate-limited login and password-reset endpoints.
- **Owner & user auth**: separate register/login/logout/`me` endpoints and
  portal pages for each role, with their own JWT cookies (`owner_token` /
  `user_token`) so an admin, owner, and user session can all be open in the
  same browser without colliding. New owner registrations trigger an admin
  notification. Owner and user dashboards show their own properties /
  contact requests respectively (read-only — see section 4 for what's not
  built yet, like the actual "Add Property" form).
- **Password reset**: emailed single-use token (hashed at rest, 30-min expiry),
  account-enumeration-safe responses, "change password" flow requiring current password.
- **Dashboard**: live stats cards (users, owners, properties by status, contact
  requests, scheduled visits, reported properties) + recent admin notifications.
- **Property approval**: pending queue, full detail view (property info, location,
  images, amenities, owner info), Approve / Reject (with reason) / Request Changes
  (with note) / Suspend / Restore / Delete, matching the `DRAFT → PENDING_APPROVAL →
  APPROVED/REJECTED/CHANGES_REQUESTED → SUSPENDED/DELETED` status flow. Owners are
  notified at each step (rows in the `notifications` table).
- **Owners**: list/search, verify, suspend, activate, delete, with per-owner
  property counts.
- **Users**: list/search, suspend, activate, delete.
- **Contact requests**: list/filter by status & type (Contact Owner / Schedule
  Visit / General Enquiry), update status (Pending → Contacted → Responded →
  Closed/Cancelled).
- **Activity log**: every admin action (login, password change, approvals,
  rejections, suspensions, deletions, etc.) is recorded with timestamp.
- **Owner privacy**: public property responses expose the owner's name only. Owner mobile and email are returned by the backend only when a valid `USER` JWT session is present. The public property details page shows `Login to view` for anonymous visitors and reveals both fields after user login.
- **Security**: bcrypt password hashing, JWT sessions, rate limiting on auth
  endpoints, parameterized SQL (no string-concatenated queries), owner contact
  details only ever returned to authenticated admin requests.

## 4. Owner property submission

Owners can now add complete property information and up to 12 public image URLs from `owner-dashboard.html`. New listings are created with `PENDING_APPROVAL` status and remain hidden from public visitors until an admin approves them.

## 4. What's stubbed / intentionally left out of this MVP

- **"Add Property" submission form for owners.** Owner accounts and login exist,
  and the owner dashboard lists their properties, but there's no UI yet to
  submit a new one. The schema and status flow already support it — `POST` a
  property row with `status = PENDING_APPROVAL` and `owner_id` set, from a
  form you build on `owner-dashboard.html`, and it shows up in the admin
  approval queue immediately. Same pattern for the "Contact Owner" flow on
  the user side.
- Image upload handling (the schema stores an `images` JSON array of URLs —
  wire up S3/Cloudinary/local disk upload and pass URLs here).
- Public property search/browse pages for anonymous visitors.
- Map picker UI (lat/lng are stored and returned; a map widget is a frontend addition).
- 2FA/OTP for admin login (marked optional in the spec).
- Owner/user password reset (only admin has the forgot-password flow right
  now — same pattern, would reuse `utils/tokens.js` and `utils/mailer.js`).
- Production-grade audit trail export/pagination beyond the 500-row cap.

## 5. Security notes before deploying

- Set `NODE_ENV=production` and serve both apps over HTTPS — the auth cookie
  is marked `secure` automatically in production, which requires HTTPS.
- Rotate `JWT_SECRET` / `RESET_TOKEN_SECRET` and never commit `.env`.
- Put the SQLite file (`backend/data/`) somewhere with proper backups, or swap
  `config/db.js` for Postgres/MySQL if you need concurrent write scale —
  the SQL is plain parameterized queries, so the swap is mostly in `config/db.js`.
- Change the seeded admin password immediately via Settings → Change Password.

## Public website and owner privacy

- The root URL (`/`) opens the public IND Homes home page instead of the admin login.
- Admin login is available at `admin-login.html`.
- Public visitors can browse approved properties and see the owner's name.
- Mobile number and email are hidden until a user logs in.
- Selecting `Login to view` on owner contact information sends the visitor to User Login and returns them to the same property after successful login.
- The backend public property API only returns owner contact fields when a valid user session is present.
