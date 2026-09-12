require('dotenv').config();
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const SESSION_SECRET = process.env.SESSION_SECRET || 'CHANGE_THIS_SESSION_SECRET';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

function requireAdminPage(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.redirect('/admin-login.html');
}

function adminCredentialsConfigured() {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD_HASH && SESSION_SECRET !== 'CHANGE_THIS_SESSION_SECRET');
}

const PORT = process.env.PORT || 3000;
const db = new Database('ridewithedwinspeed.db');

app.use(express.json());


app.get('/rider-dashboard.html', (req, res, next) => {
  if (req.session?.riderId) {
    return res.sendFile(path.join(__dirname, 'rider-dashboard.html'));
  }
  return res.redirect('/rider-login.html');
});

app.get('/admin.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(__dirname));

db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  service TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pickup TEXT NOT NULL,
  dropoff TEXT NOT NULL,
  details TEXT NOT NULL,
  preferred_time TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  rider_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);



db.exec(`
  CREATE TABLE IF NOT EXISTS riders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    bike_model TEXT,
    plate_number TEXT,
    status TEXT NOT NULL DEFAULT 'Pending Approval',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rider_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_reference TEXT NOT NULL UNIQUE,
    rider_id INTEGER NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);


// ---------------- RIDER AUTH & MANAGEMENT ----------------

app.post('/api/riders/register', async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const address = String(req.body?.address || '').trim();
  const bikeModel = String(req.body?.bikeModel || '').trim();
  const plateNumber = String(req.body?.plateNumber || '').trim();
  const password = String(req.body?.password || '');

  if (!fullName || !phone || !password) {
    return res.status(400).json({ error: 'Full name, phone number and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db.prepare('SELECT id FROM riders WHERE phone = ? OR (email IS NOT NULL AND email != "" AND email = ?)').get(phone, email);
  if (existing) return res.status(409).json({ error: 'A rider with this phone or email already exists.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const result = db.prepare(`
    INSERT INTO riders (full_name, phone, email, address, bike_model, plate_number, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(fullName, phone, email, address, bikeModel, plateNumber, passwordHash);

  res.status(201).json({
    success: true,
    riderId: result.lastInsertRowid,
    message: 'Registration submitted. The owner must approve your rider account before you can log in.'
  });
});

app.post('/api/riders/login', async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const rider = db.prepare('SELECT * FROM riders WHERE lower(phone) = ? OR lower(email) = ?').get(identifier, identifier);

  if (!rider || !(await bcrypt.compare(password, rider.password_hash))) {
    return res.status(401).json({ error: 'Invalid phone/email or password.' });
  }
  if (rider.status !== 'Approved') {
    return res.status(403).json({ error: `Your account is currently "${rider.status}". Please wait for owner approval.` });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not create secure session.' });
    req.session.riderId = rider.id;
    req.session.riderName = rider.full_name;
    res.json({ success: true });
  });
});

app.get('/api/riders/me', (req, res) => {
  if (!req.session?.riderId) return res.status(401).json({ authenticated: false });
  const rider = db.prepare(`
    SELECT id, full_name, phone, email, address, bike_model, plate_number, status, created_at
    FROM riders WHERE id = ?
  `).get(req.session.riderId);
  if (!rider) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, rider });
});

app.post('/api/riders/logout', (req, res) => {
  const wasRider = Boolean(req.session?.riderId);
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: wasRider });
  });
});

function requireRider(req, res, next) {
  if (req.session?.riderId) return next();
  return res.status(401).json({ error: 'Rider authentication required.' });
}

app.get('/api/riders/my-bookings', requireRider, (req, res) => {
  const rows = db.prepare(`
    SELECT b.reference, b.service, b.customer_name, b.customer_phone,
           b.pickup, b.dropoff, b.details, b.preferred_time, b.status, b.created_at
    FROM bookings b
    INNER JOIN rider_assignments a ON a.booking_reference = b.reference
    WHERE a.rider_id = ?
    ORDER BY b.created_at DESC
  `).all(req.session.riderId);
  res.json(rows);
});

// Owner: list riders
app.get('/api/riders', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, full_name, phone, email, address, bike_model, plate_number, status, created_at
    FROM riders ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

// Owner: approve/reject rider
app.patch('/api/riders/:id/status', requireAdmin, (req, res) => {
  const allowed = ['Pending Approval', 'Approved', 'Suspended', 'Rejected'];
  const status = String(req.body?.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid rider status.' });

  const result = db.prepare('UPDATE riders SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Rider not found.' });
  res.json({ success: true });
});

// Owner: assign a booking to a rider
app.patch('/api/bookings/:reference/assign-rider', requireAdmin, (req, res) => {
  const riderId = Number(req.body?.riderId);
  const rider = db.prepare('SELECT id, full_name, status FROM riders WHERE id = ?').get(riderId);
  if (!rider) return res.status(404).json({ error: 'Rider not found.' });
  if (rider.status !== 'Approved') return res.status(400).json({ error: 'Only approved riders can be assigned.' });

  const booking = db.prepare('SELECT reference FROM bookings WHERE reference = ?').get(req.params.reference);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  db.prepare(`
    INSERT INTO rider_assignments (booking_reference, rider_id)
    VALUES (?, ?)
    ON CONFLICT(booking_reference) DO UPDATE SET rider_id = excluded.rider_id, assigned_at = CURRENT_TIMESTAMP
  `).run(req.params.reference, riderId);

  db.prepare('UPDATE bookings SET status = ? WHERE reference = ?').run('Rider Assigned', req.params.reference);
  res.json({ success: true, rider: rider.full_name });
});

// Rider: update status for an assigned booking
app.patch('/api/riders/my-bookings/:reference/status', requireRider, (req, res) => {
  const allowed = ['Picked Up', 'On the Way', 'Delivered'];
  const status = String(req.body?.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid delivery status.' });

  const assignment = db.prepare(`
    SELECT id FROM rider_assignments WHERE booking_reference = ? AND rider_id = ?
  `).get(req.params.reference, req.session.riderId);
  if (!assignment) return res.status(403).json({ error: 'This booking is not assigned to you.' });

  const result = db.prepare('UPDATE bookings SET status = ? WHERE reference = ?').run(status, req.params.reference);
  if (!result.changes) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => {
  if (req.session && req.session.admin === true) {
    return res.json({ authenticated: true, email: req.session.adminEmail });
  }
  return res.status(401).json({ authenticated: false });
});

app.post('/api/admin/login', async (req, res) => {
  if (!adminCredentialsConfigured()) {
    return res.status(503).json({
      error: 'Admin login is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET on the server.'
    });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (email !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not create secure session.' });
    req.session.admin = true;
    req.session.adminEmail = ADMIN_EMAIL;
    res.json({ success: true, message: 'Login successful.' });
  });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.post('/api/bookings', (req,res)=>{
  const b=req.body;
  if(!b.reference||!b.service||!b.name||!b.phone||!b.pickup||!b.dropoff||!b.details){
    return res.status(400).json({error:'Missing required booking fields'});
  }
  try{
    db.prepare(`INSERT INTO bookings
      (reference,service,name,phone,pickup,dropoff,details,preferred_time)
      VALUES (@reference,@service,@name,@phone,@pickup,@dropoff,@details,@preferred_time)`).run(b);
    res.status(201).json({reference:b.reference,status:'Pending'});
  }catch(e){
    res.status(409).json({error:'Booking reference already exists'});
  }
});

app.get('/api/bookings/:reference',(req,res)=>{
  const b=db.prepare('SELECT * FROM bookings WHERE reference=?').get(req.params.reference);
  if(!b) return res.status(404).json({error:'Booking not found'});
  res.json(b);
});

app.get('/api/bookings',(req,res)=>{
  const rows=db.prepare('SELECT * FROM bookings ORDER BY id DESC').all();
  res.json(rows);
});

app.patch('/api/bookings/:reference',(req,res)=>{
  const allowed=['Pending','Rider Assigned','Picked Up','On the Way','Delivered','Cancelled'];
  if(!allowed.includes(req.body.status)) return res.status(400).json({error:'Invalid status'});
  const result=db.prepare('UPDATE bookings SET status=?, rider_name=? WHERE reference=?')
    .run(req.body.status, req.body.rider_name || null, req.params.reference);
  if(!result.changes) return res.status(404).json({error:'Booking not found'});
  res.json(db.prepare('SELECT * FROM bookings WHERE reference=?').get(req.params.reference));
});

app.listen(PORT,()=>console.log(`RideWithEdwinSpeed server running on port ${PORT}`));
