const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/connection');
const { generateToken } = require('../middleware/auth');
const { validate, loginSchema, signupSchema } = require('../middleware/validate');

const router = express.Router();

// POST /api/users/login
router.post('/login', validate(loginSchema), (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  const token = generateToken(user);
  const session = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
  };

  // Log activity
  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)').run(user.id, user.username, 'login');

  res.json({ success: true, user: session, token });
});

// POST /api/users/signup
router.post('/signup', validate(signupSchema), (req, res) => {
  const { username, email, password, role, fullName } = req.body;

  // Check duplicates
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  if (existing) return res.status(400).json({ error: 'Username already exists' });

  const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

  // Only superadmins can create admin/superadmin accounts
  const finalRole = role === 'user' ? 'user' : 'user'; // Force 'user' for self-signup

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    'INSERT INTO users (username, email, password, role, full_name) VALUES (?, ?, ?, ?, ?)'
  ).run(username, email.toLowerCase(), hash, finalRole, fullName);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(user);
  const session = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
  };

  // Log activity
  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)').run(user.id, user.username, 'signup');

  res.json({ success: true, user: session, token });
});

// GET /api/users — list all users (admin only, no passwords)
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, full_name, created_at FROM users').all();
  res.json(users.map(u => ({ ...u, fullName: u.full_name, createdAt: u.created_at })));
});

// GET /api/activity — activity log
router.get('/activity', (req, res) => {
  const activity = db.prepare('SELECT * FROM activity ORDER BY timestamp DESC LIMIT 200').all();
  res.json(activity.map(a => ({
    userId: a.user_id,
    username: a.username,
    action: a.action,
    timestamp: a.timestamp,
  })));
});

// POST /api/activity — manual activity entry (e.g. logout)
router.post('/activity', (req, res) => {
  const { userId, username, action } = req.body;
  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)').run(userId || 0, username || '', action || '');
  res.json({ success: true });
});

module.exports = router;
