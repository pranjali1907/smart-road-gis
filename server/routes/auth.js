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

// GET /api/users/me — get current user details
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const user = db.prepare('SELECT id, username, email, role, full_name FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
  });
});

// GET /api/users — list all users (admin only, no passwords)
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, full_name, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, fullName: u.full_name, createdAt: u.created_at })));
});

// PUT /api/users/:id/role — change a user's role (superadmin only)
router.put('/:id/role', (req, res) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }

  const userId = parseInt(req.params.id);
  const { role } = req.body;
  const allowedRoles = ['user', 'admin', 'superadmin'];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
  }

  // Can't change your own role (prevents self-lockout)
  if (userId === req.user.id) {
    return res.status(403).json({ error: 'You cannot change your own role' });
  }

  const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // If demoting a superadmin, ensure at least one superadmin remains
  if (target.role === 'superadmin' && role !== 'superadmin') {
    const saCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='superadmin'").get().c;
    if (saCount <= 1) {
      return res.status(403).json({ error: 'Cannot demote the last Super Admin — at least one must exist' });
    }
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)')
    .run(req.user.id, req.user.username, `role_change:${target.username}:${target.role}->${role}`);

  const updated = db.prepare('SELECT id, username, email, role, full_name, created_at FROM users WHERE id = ?').get(userId);
  res.json({ success: true, user: { id: updated.id, username: updated.username, email: updated.email, role: updated.role, fullName: updated.full_name } });
});

// DELETE /api/users/:id — delete a user (superadmin only)
router.delete('/:id', (req, res) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }

  const userId = parseInt(req.params.id);

  if (userId === req.user.id) {
    return res.status(403).json({ error: 'You cannot delete yourself' });
  }

  const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.role === 'superadmin') {
    const saCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='superadmin'").get().c;
    if (saCount <= 1) {
      return res.status(403).json({ error: 'Cannot delete the last Super Admin' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)')
    .run(req.user.id, req.user.username, `user_deleted:${target.username}`);

  res.json({ success: true });
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

// PUT /api/users/me/password — change own password (any authenticated user)
router.put('/me/password', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(403).json({ error: 'Current password is incorrect' });

  const hashed = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)')
    .run(req.user.id, req.user.username, 'password_change');

  res.json({ success: true, message: 'Password updated successfully' });
});

// PUT /api/users/me/profile — update own profile (username, email, fullName)
router.put('/me/profile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { username, email, fullName } = req.body;

  // Check uniqueness
  if (username) {
    const clash = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (clash) return res.status(409).json({ error: 'Username already taken' });
  }
  if (email) {
    const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
    if (clash) return res.status(409).json({ error: 'Email already in use' });
  }

  db.prepare(`
    UPDATE users SET
      username = COALESCE(NULLIF(?, ''), username),
      email = COALESCE(NULLIF(?, ''), email),
      full_name = COALESCE(NULLIF(?, ''), full_name)
    WHERE id = ?
  `).run(username || '', email || '', fullName || '', req.user.id);

  const updated = db.prepare('SELECT id, username, email, role, full_name FROM users WHERE id = ?').get(req.user.id);
  const { generateToken } = require('../middleware/auth');
  const newToken = generateToken(updated);

  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)')
    .run(req.user.id, updated.username, 'profile_update');

  res.json({ success: true, token: newToken, user: { id: updated.id, username: updated.username, email: updated.email, role: updated.role, fullName: updated.full_name } });
});

module.exports = router;
