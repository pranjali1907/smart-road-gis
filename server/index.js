const path = require('path');
const fs = require('fs');

// Try loading .env from current directory first, then parent (root)
const localEnv = path.join(__dirname, '.env');
const rootEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(localEnv)) require('dotenv').config({ path: localEnv });
else if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initSchema, migrateExistingData } = require('./db/schema');
const { authMiddleware } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const roadsRoutes = require('./routes/roads');
const datasetsRoutes = require('./routes/datasets');
const historyRoutes = require('./routes/history');
const trashRoutes = require('./routes/trash');
const imageryRoutes = require('./routes/imagery');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS Origins ───
// CORS_ORIGIN env var can be a comma-separated list for multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').map(o => o.trim()).forEach(o => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

// ─── Security Middleware ───
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, mobile apps, same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin === 'https://smart-road-gis.vercel.app') return callback(null, true);
    // Allow any *.vercel.app origin for preview deployments
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    // Allow any *.amplifyapp.com origin for AWS Amplify deployments
    if (/\.amplifyapp\.com$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// Rate limiting — generous for dev; imagery tiles are excluded entirely
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.path.includes('/imagery/') && req.path.includes('/tile/'),
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/signup', authLimiter);

// Body parsing
app.use(express.json({ limit: '100mb' }));

// ─── Auth Middleware ───
app.use(authMiddleware);

// ─── Routes ───
app.use('/api/users', authRoutes);
app.use('/api/roads', roadsRoutes);
app.use('/api/datasets', datasetsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/imagery', imageryRoutes);

// ─── Health Check (DB-aware) ───
const db = require('./db/connection');
app.get('/api/health', (req, res) => {
  try {
    // Verify the database is actually responsive
    const row = db.prepare('SELECT 1 AS ok').get();
    if (row && row.ok === 1) {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'error', message: 'Database check failed' });
    }
  } catch (err) {
    console.error('Health check DB error:', err.message);
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// ─── Static Frontend Serving (in production / if dist exists) ───
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Process-level crash handlers ───
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — keeping server alive:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — keeping server alive:', reason);
});

// ─── Initialize Database & Start ───
console.log('\n  🚀 Smart Road GIS Backend Server');
console.log('  ─────────────────────────────────');
initSchema();
migrateExistingData();
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`  ➜  Local:   http://localhost:${PORT}`);
  console.log(`  ➜  CORS:    ${allowedOrigins.join(', ')}`);
  console.log(`  ➜  Auth:    JWT (24h tokens)`);
  console.log(`  ➜  DB:      SQLite (WAL mode)`);
  console.log('\n  All data is stored in the SQLite database.\n');

  // ─── Keep-alive self-ping ───
  // Prevents Render free tier from sleeping the server after 15 min of inactivity
  const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
  setInterval(() => {
    fetch(`http://localhost:${PORT}/api/health`)
      .then(() => console.log('  ♻  Keep-alive ping OK'))
      .catch(() => console.warn('  ♻  Keep-alive ping failed'));
  }, KEEP_ALIVE_INTERVAL);
});

// ─── Graceful shutdown ───
const shutdown = (signal) => {
  console.log(`\n  Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('  Server closed.');
    try { db.close(); } catch (e) { /* already closed */ }
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => { process.exit(1); }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

