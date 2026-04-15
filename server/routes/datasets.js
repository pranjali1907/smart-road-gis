const express = require('express');
const db = require('../db/connection');
const { requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/datasets — list all datasets
router.get('/', (req, res) => {
  const datasets = db.prepare('SELECT * FROM datasets ORDER BY created_at DESC').all();
  res.json(datasets.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    uploadedBy: d.uploaded_by,
    roadCount: d.road_count,
    createdAt: d.created_at,
    isDefault: !!d.is_default,
  })));
});

// GET /api/datasets/:id — get single dataset
router.get('/:id', (req, res) => {
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(parseInt(req.params.id));
  if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
  res.json({
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    uploadedBy: dataset.uploaded_by,
    roadCount: dataset.road_count,
    createdAt: dataset.created_at,
    isDefault: !!dataset.is_default,
  });
});

// POST /api/datasets — create new dataset (super admin only)
router.post('/', requireSuperAdmin, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Dataset name is required' });

  const result = db.prepare(
    'INSERT INTO datasets (name, description, uploaded_by) VALUES (?, ?, ?)'
  ).run(name, description || '', req.user?.username || 'superadmin');

  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(result.lastInsertRowid);
  res.json({
    success: true,
    dataset: {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      uploadedBy: dataset.uploaded_by,
      roadCount: dataset.road_count,
      createdAt: dataset.created_at,
      isDefault: !!dataset.is_default,
    },
  });
});

// POST /api/datasets/:id/import — import roads into a dataset (super admin only)
router.post('/:id/import', requireSuperAdmin, (req, res) => {
  const datasetId = parseInt(req.params.id);
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId);
  if (!dataset) return res.status(404).json({ error: 'Dataset not found' });

  const { roads, mode } = req.body; // mode: 'append' | 'replace'
  if (!roads || !Array.isArray(roads)) return res.status(400).json({ error: 'roads array is required' });

  if (mode === 'replace') {
    db.prepare('DELETE FROM roads WHERE dataset_id = ?').run(datasetId);
  }

  const insertRoad = db.prepare(`
    INSERT OR IGNORE INTO roads (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
      length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
      surface_material, drainage_type, zone, ward_no, status, remarks, geometry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const importTx = db.transaction((roadList) => {
    for (let i = 0; i < roadList.length; i++) {
      const r = roadList[i];
      const id = r.id || `RD-${String(i + 1).padStart(4, '0')}`;
      insertRoad.run(
        id, datasetId, r.srNo || i + 1, r.fid || i + 1, r.name || '',
        r.fromChainage || 0, r.toChainage || 0, r.length || 0, r.width || 0,
        r.roadType || '', r.contractor || '', r.constructionDate || '',
        r.maintenanceDate || '', r.lastRepair || '', r.surfaceMaterial || '',
        r.drainageType || '', r.zone || '', r.wardNo || '', r.status || 'Good',
        r.remarks || '', JSON.stringify(r.geometry || {})
      );
    }
  });

  importTx(roads);

  // Update count
  const count = db.prepare('SELECT COUNT(*) as c FROM roads WHERE dataset_id = ?').get(datasetId).c;
  db.prepare('UPDATE datasets SET road_count = ? WHERE id = ?').run(count, datasetId);

  // History
  db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(datasetId, 'SYSTEM', 'Dataset', mode === 'replace' ? 'Dataset Replaced' : 'Dataset Appended', '', `${roads.length} roads imported`, req.user?.username || 'superadmin');

  res.json({ success: true, roadCount: count });
});

// DELETE /api/datasets/:id — delete dataset (super admin only)
router.delete('/:id', requireSuperAdmin, (req, res) => {
  const datasetId = parseInt(req.params.id);
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId);
  if (!dataset) return res.status(404).json({ error: 'Dataset not found' });

  // Delete roads, trash, history for this dataset (CASCADE handles it if FK set, but be explicit)
  db.prepare('DELETE FROM roads WHERE dataset_id = ?').run(datasetId);
  db.prepare('DELETE FROM trash WHERE dataset_id = ?').run(datasetId);
  db.prepare('DELETE FROM history WHERE dataset_id = ?').run(datasetId);
  db.prepare('DELETE FROM datasets WHERE id = ?').run(datasetId);

  res.json({ success: true });
});

// PUT /api/datasets/:id/default — set as default dataset
router.put('/:id/default', requireSuperAdmin, (req, res) => {
  const datasetId = parseInt(req.params.id);
  db.prepare('UPDATE datasets SET is_default = 0').run(); // clear all
  db.prepare('UPDATE datasets SET is_default = 1 WHERE id = ?').run(datasetId);
  res.json({ success: true });
});

module.exports = router;
