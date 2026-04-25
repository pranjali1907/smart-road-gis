require('dotenv').config({ path: require('path').join(__dirname, '.env') });
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

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Initialize Database & Start ───
console.log('\n  🚀 Smart Road GIS Backend Server');
console.log('  ─────────────────────────────────');
initSchema();
migrateExistingData();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`  ➜  Local:   http://localhost:${PORT}`);
  console.log(`  ➜  CORS:    ${allowedOrigins.join(', ')}`);
  console.log(`  ➜  Auth:    JWT (24h tokens)`);
  console.log(`  ➜  DB:      SQLite (WAL mode)`);
  console.log('\n  All data is stored in the SQLite database.\n');
});
