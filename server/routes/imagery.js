const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const { requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'imagery');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.tif', '.tiff', '.ecw', '.geotiff'];
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Only GeoTIFF (.tif/.tiff) and ECW (.ecw) files are accepted. Got: ${ext}`));
  },
});

// ── Ensure imagery table exists ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS imagery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    dataset_id INTEGER,
    uploaded_by TEXT NOT NULL,
    visible INTEGER DEFAULT 1,
    opacity REAL DEFAULT 0.7,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/imagery — list all imagery (any authenticated user)
router.get('/', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const rows = db.prepare('SELECT * FROM imagery ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    filename: r.filename,
    originalName: r.original_name,
    fileType: r.file_type,
    fileSize: r.file_size,
    datasetId: r.dataset_id,
    uploadedBy: r.uploaded_by,
    visible: r.visible === 1,
    opacity: r.opacity,
    createdAt: r.created_at,
    canRender: ['.tif', '.tiff', '.geotiff'].includes(r.file_type.toLowerCase()),
  })));
});

// POST /api/imagery — upload imagery (superadmin only, up to 20 files at once)
router.post('/', requireSuperAdmin, (req, res) => {
  upload.array('imagery', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const datasetId = req.body.datasetId ? parseInt(req.body.datasetId) : null;
    const inserted = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      // Use custom name only when uploading a single file; otherwise use filename
      const name = req.files.length === 1 && req.body.name
        ? req.body.name
        : path.basename(file.originalname, ext).replace(/[_-]/g, ' ');

      const result = db.prepare(`
        INSERT INTO imagery (name, filename, original_name, file_type, file_size, dataset_id, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(name, file.filename, file.originalname, ext, file.size, datasetId, req.user.username);

      db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)')
        .run(req.user.id, req.user.username, `imagery_upload:${name}${ext}`);

      inserted.push({ id: result.lastInsertRowid, name, filename: file.filename, fileType: ext, fileSize: file.size });
    }

    res.status(201).json({ success: true, count: inserted.length, imagery: inserted });
  });
});

// PATCH /api/imagery/:id — update visibility/opacity (superadmin only)
router.patch('/:id', requireSuperAdmin, (req, res) => {
  const { visible, opacity, name } = req.body;
  const id = parseInt(req.params.id);
  const row = db.prepare('SELECT * FROM imagery WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Imagery not found' });

  if (visible !== undefined) db.prepare('UPDATE imagery SET visible = ? WHERE id = ?').run(visible ? 1 : 0, id);
  if (opacity !== undefined) db.prepare('UPDATE imagery SET opacity = ? WHERE id = ?').run(parseFloat(opacity), id);
  if (name !== undefined) db.prepare('UPDATE imagery SET name = ? WHERE id = ?').run(name, id);

  res.json({ success: true });
});

// DELETE /api/imagery/:id — delete imagery (superadmin only)
router.delete('/:id', requireSuperAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const row = db.prepare('SELECT * FROM imagery WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Imagery not found' });

  // Delete file from disk
  const filePath = path.join(UPLOAD_DIR, row.filename);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}

  db.prepare('DELETE FROM imagery WHERE id = ?').run(id);
  db.prepare('INSERT INTO activity (user_id, username, action) VALUES (?, ?, ?)')
    .run(req.user.id, req.user.username, `imagery_delete:${row.name}`);

  res.json({ success: true });
});

// GET /api/imagery/:id/file — serve the imagery file (authenticated)
router.get('/:id/file', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const id = parseInt(req.params.id);
  const row = db.prepare('SELECT * FROM imagery WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Imagery not found' });

  const filePath = path.join(UPLOAD_DIR, row.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Type', 'image/tiff');
  res.setHeader('Content-Disposition', `inline; filename="${row.original_name}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
