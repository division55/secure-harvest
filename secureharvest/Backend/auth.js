const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'secureharvest.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS farmers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    boundary_json TEXT,
    area_acres REAL NOT NULL,
    crop_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS investors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Keep existing coursework/demo databases usable when the farm pin fields are added.
const plotColumns = db.prepare('PRAGMA table_info(plots)').all().map((column) => column.name);
if (!plotColumns.includes('latitude')) db.exec('ALTER TABLE plots ADD COLUMN latitude REAL');
if (!plotColumns.includes('longitude')) db.exec('ALTER TABLE plots ADD COLUMN longitude REAL');
if (!plotColumns.includes('boundary_json')) db.exec('ALTER TABLE plots ADD COLUMN boundary_json TEXT');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('WARNING: Set JWT_SECRET in Backend/.env before using authentication.');
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token || !JWT_SECRET) {
    return res.status(401).json({ error: 'Please log in first.' });
  }

  try {
    req.farmer = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must contain at least 8 characters.' });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server authentication is not configured.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO farmers (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(name.trim(), normalizedEmail, passwordHash);

    const farmer = {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      email: normalizedEmail
    };

    const token = jwt.sign(farmer, JWT_SECRET, { expiresIn: '8h' });

    return res.status(201).json({ message: 'Account created.', farmer, token });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Could not create account.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server authentication is not configured.' });
    }

    const farmer = db.prepare(`
      SELECT id, name, email, password_hash
      FROM farmers
      WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (!farmer || !(await bcrypt.compare(password, farmer.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const publicFarmer = {
      id: farmer.id,
      name: farmer.name,
      email: farmer.email
    };

    const token = jwt.sign(publicFarmer, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      message: 'Login successful.',
      farmer: publicFarmer,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Could not log in.' });
  }
});

// A repeatable, seeded account for classroom demonstrations.
router.post('/demo', async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Demo access is unavailable until JWT_SECRET is configured.' });
    }

    const email = 'demo@secureharvest.local';
    let farmer = db.prepare('SELECT id, name, email FROM farmers WHERE email = ?').get(email);
    if (!farmer) {
      const passwordHash = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10);
      const result = db.prepare(`
        INSERT INTO farmers (name, email, password_hash) VALUES (?, ?, ?)
      `).run('Asha Raman', email, passwordHash);
      farmer = { id: Number(result.lastInsertRowid), name: 'Asha Raman', email };
    }

    const plotCount = db.prepare('SELECT COUNT(*) AS count FROM plots WHERE farmer_id = ?').get(farmer.id).count;
    if (plotCount === 0) {
      const addPlot = db.prepare(`
        INSERT INTO plots (farmer_id, name, location, latitude, longitude, area_acres, crop_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const seedPlots = db.transaction(() => {
        addPlot.run(farmer.id, 'North Field', 'Dharwad, Karnataka', 15.4589, 75.0078, 4.5, 'Cotton');
        addPlot.run(farmer.id, 'River Bend', 'Dharwad, Karnataka', 15.4217, 75.0061, 2.8, 'Maize');
      });
      seedPlots();
    }

    // Demo locations are approximate map pins, not surveyed farm boundaries.
    db.prepare(`UPDATE plots SET latitude = ?, longitude = ?
      WHERE farmer_id = ? AND name = 'North Field' AND latitude IS NULL`)
      .run(15.4589, 75.0078, farmer.id);
    db.prepare(`UPDATE plots SET latitude = ?, longitude = ?
      WHERE farmer_id = ? AND name = 'River Bend' AND latitude IS NULL`)
      .run(15.4217, 75.0061, farmer.id);

    const token = jwt.sign(farmer, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ message: 'Demo account ready.', farmer, token });
  } catch (error) {
    console.error('Demo account error:', error);
    return res.status(500).json({ error: 'Could not prepare the demo account.' });
  }
});

router.post('/investor/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must contain at least 8 characters.' });
    if (!JWT_SECRET) return res.status(500).json({ error: 'Investor accounts are not configured.' });
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO investors (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name.trim(), normalizedEmail, passwordHash);
    const investor = { id: Number(result.lastInsertRowid), name: name.trim(), email: normalizedEmail, role: 'INVESTOR' };
    const token = jwt.sign(investor, JWT_SECRET, { expiresIn: '8h' });
    return res.status(201).json({ investor, token });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An investor account with this email already exists.' });
    console.error('Investor registration error:', error);
    return res.status(500).json({ error: 'Could not create investor account.' });
  }
});

router.post('/investor/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) return res.status(400).json({ error: 'Email and password are required.' });
    if (!JWT_SECRET) return res.status(500).json({ error: 'Investor accounts are not configured.' });
    const row = db.prepare('SELECT id, name, email, password_hash FROM investors WHERE email = ?')
      .get(email.trim().toLowerCase());
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: 'Invalid investor email or password.' });
    }
    const investor = { id: row.id, name: row.name, email: row.email, role: 'INVESTOR' };
    const token = jwt.sign(investor, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ investor, token });
  } catch (error) {
    console.error('Investor login error:', error);
    return res.status(500).json({ error: 'Could not sign in.' });
  }
});

router.post('/investor/demo', async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(500).json({ error: 'Demo access is unavailable until JWT_SECRET is configured.' });
    const email = 'investor.demo@secureharvest.local';
    let investor = db.prepare('SELECT id, name, email FROM investors WHERE email = ?').get(email);
    if (!investor) {
      const passwordHash = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10);
      const result = db.prepare('INSERT INTO investors (name, email, password_hash) VALUES (?, ?, ?)')
        .run('Demo Investor', email, passwordHash);
      investor = { id: Number(result.lastInsertRowid), name: 'Demo Investor', email };
    }
    const session = { ...investor, role: 'INVESTOR' };
    const token = jwt.sign(session, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ investor: session, token });
  } catch (error) {
    console.error('Investor demo error:', error);
    return res.status(500).json({ error: 'Could not open the investor demo account.' });
  }
});

router.get('/me', authenticate, (req, res) => {
  const farmer = db.prepare(`
    SELECT id, name, email, created_at
    FROM farmers WHERE id = ?
  `).get(req.farmer.id);

  if (!farmer) return res.status(404).json({ error: 'Farmer not found.' });
  return res.json({ farmer });
});

router.get('/plots', authenticate, (req, res) => {
  const plots = db.prepare(`
    SELECT id, name, location, latitude, longitude, boundary_json AS boundary,
           area_acres AS areaAcres,
           crop_type AS cropType, created_at AS createdAt
    FROM plots
    WHERE farmer_id = ?
    ORDER BY id DESC
  `).all(req.farmer.id);

  plots.forEach((plot) => { if (plot.boundary) plot.boundary = JSON.parse(plot.boundary); });

  return res.json({ plots });
});

router.post('/plots', authenticate, (req, res) => {
  const { name, location, latitude, longitude, boundary, areaAcres, cropType } = req.body;
  const validBoundary = boundary == null || (Array.isArray(boundary) && boundary.length >= 3 && boundary.every((point) =>
    Number.isFinite(Number(point.latitude)) && Number(point.latitude) >= -90 && Number(point.latitude) <= 90 &&
    Number.isFinite(Number(point.longitude)) && Number(point.longitude) >= -180 && Number(point.longitude) <= 180));

  if (
    !name?.trim() ||
    !location?.trim() ||
    !cropType?.trim() ||
    latitude === undefined || latitude === null ||
    !Number.isFinite(Number(latitude)) ||
    Number(latitude) < -90 ||
    Number(latitude) > 90 ||
    longitude === undefined || longitude === null ||
    !Number.isFinite(Number(longitude)) ||
    Number(longitude) < -180 ||
    Number(longitude) > 180 ||
    areaAcres === undefined ||
    areaAcres === null ||
    !Number.isFinite(Number(areaAcres)) ||
    Number(areaAcres) <= 0 || !validBoundary
  ) {
    return res.status(400).json({
      error: 'Provide plot name, location, map coordinates, crop type and a positive area in acres.'
    });
  }

  const result = db.prepare(`
    INSERT INTO plots (farmer_id, name, location, latitude, longitude, boundary_json, area_acres, crop_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.farmer.id,
    name.trim(),
    location.trim(),
    Number(latitude),
    Number(longitude),
    boundary && boundary.length >= 3 ? JSON.stringify(boundary) : null,
    Number(areaAcres),
    cropType.trim()
  );

  const plot = db.prepare(`
    SELECT id, name, location, latitude, longitude, boundary_json AS boundary,
           area_acres AS areaAcres,
           crop_type AS cropType, created_at AS createdAt
    FROM plots WHERE id = ?
  `).get(Number(result.lastInsertRowid));
  if (plot?.boundary) plot.boundary = JSON.parse(plot.boundary);

  return res.status(201).json({ message: 'Plot created.', plot });
});

router.patch('/plots/:id/location', authenticate, (req, res) => {
  const { latitude, longitude } = req.body;
  if (
    latitude === undefined || latitude === null ||
    !Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90 ||
    longitude === undefined || longitude === null ||
    !Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180
  ) {
    return res.status(400).json({ error: 'Provide valid map coordinates.' });
  }

  const result = db.prepare(`UPDATE plots SET latitude = ?, longitude = ?
    WHERE id = ? AND farmer_id = ?`)
    .run(Number(latitude), Number(longitude), Number(req.params.id), req.farmer.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Plot not found.' });

  const plot = db.prepare(`SELECT id, name, location, latitude, longitude, boundary_json AS boundary,
      area_acres AS areaAcres, crop_type AS cropType, created_at AS createdAt
    FROM plots WHERE id = ? AND farmer_id = ?`)
    .get(Number(req.params.id), req.farmer.id);
  if (plot?.boundary) plot.boundary = JSON.parse(plot.boundary);
  return res.json({ message: 'Farm map pin saved.', plot });
});

router.delete('/plots/:id', authenticate, (req, res) => {
  const result = db.prepare(`
    DELETE FROM plots WHERE id = ? AND farmer_id = ?
  `).run(Number(req.params.id), req.farmer.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Plot not found.' });
  }

  return res.json({ message: 'Plot deleted.' });
});

module.exports = router;
module.exports.authenticate = authenticate;
