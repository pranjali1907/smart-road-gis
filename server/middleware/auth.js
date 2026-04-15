const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'smartroad-fallback-secret';

// Public routes that don't require auth
const PUBLIC_ROUTES = [
  { method: 'POST', path: '/api/users/login' },
  { method: 'POST', path: '/api/users/signup' },
  { method: 'GET', path: '/api/health' },
];

function authMiddleware(req, res, next) {
  // Check if route is public
  const isPublic = PUBLIC_ROUTES.some(
    r => r.method === req.method && req.path === r.path
  );
  if (isPublic) return next();

  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    // Allow token via query param for direct downloads (e.g. Excel export)
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, email, fullName }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, email: user.email, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = { authMiddleware, requireAdmin, requireSuperAdmin, generateToken };
