const express = require('express');
const db = require('../db/connection');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper
function rowToRoad(row) {
  return {
    id: row.id,
    srNo: row.sr_no,
    fid: row.fid,
    name: row.name,
    fromChainage: row.from_chainage,
    toChainage: row.to_chainage,
    length: row.length,
    width: row.width,
    roadType: row.road_type,
    contractor: row.contractor,
    constructionDate: row.construction_date,
    maintenanceDate: row.maintenance_date,
    lastRepair: row.last_repair,
    surfaceMaterial: row.surface_material,
    drainageType: row.drainage_type,
    zone: row.zone,
    wardNo: row.ward_no,
    status: row.status,
    remarks: row.remarks,
    geometry: JSON.parse(row.geometry || '{}'),
    datasetId: row.dataset_id,
    _deletedBy: row.deleted_by,
    _deletedAt: row.deleted_at,
  };
}

// GET /api/trash?datasetId=... (SuperAdmin only)
router.get('/', requireSuperAdmin, (req, res) => {
  const { datasetId } = req.query;
  if (!datasetId) return res.status(400).json({ error: 'datasetId is required' });
  const rows = db.prepare('SELECT * FROM trash WHERE dataset_id = ? ORDER BY deleted_at DESC').all(parseInt(datasetId));
  res.json(rows.map(rowToRoad));
});

// POST /api/trash/restore/:datasetId/:id — restore from trash (SuperAdmin only)
router.post('/restore/:datasetId/:id', requireSuperAdmin, (req, res) => {
  const datasetId = parseInt(req.params.datasetId);
  const { id } = req.params;

  const trashed = db.prepare('SELECT * FROM trash WHERE id = ? AND dataset_id = ?').get(id, datasetId);
  if (!trashed) return res.status(404).json({ error: 'Not found in trash' });

  // Move back to roads
  db.prepare(`
    INSERT INTO roads (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
      length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
      surface_material, drainage_type, zone, ward_no, status, remarks, geometry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trashed.id, datasetId, trashed.sr_no, trashed.fid, trashed.name,
    trashed.from_chainage, trashed.to_chainage, trashed.length, trashed.width,
    trashed.road_type, trashed.contractor, trashed.construction_date,
    trashed.maintenance_date, trashed.last_repair, trashed.surface_material,
    trashed.drainage_type, trashed.zone, trashed.ward_no, trashed.status,
    trashed.remarks, trashed.geometry);

  db.prepare('DELETE FROM trash WHERE id = ? AND dataset_id = ?').run(id, datasetId);

  // Update count
  db.prepare('UPDATE datasets SET road_count = (SELECT COUNT(*) FROM roads WHERE dataset_id = ?) WHERE id = ?').run(datasetId, datasetId);

  // History
  db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(datasetId, id, trashed.name || '', 'Restored', 'From trash', 'Road restored from trash', req.user?.username || 'system');

  res.json({ success: true, road: rowToRoad(trashed) });
});

// POST /api/trash/restore-all/:datasetId (SuperAdmin only)
router.post('/restore-all/:datasetId', requireSuperAdmin, (req, res) => {
  const datasetId = parseInt(req.params.datasetId);
  const trashList = db.prepare('SELECT * FROM trash WHERE dataset_id = ?').all(datasetId);

  if (trashList.length === 0) return res.json({ success: true, count: 0 });

  const insertRoad = db.prepare(`
    INSERT INTO roads (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
      length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
      surface_material, drainage_type, zone, ward_no, status, remarks, geometry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const restoreTx = db.transaction(() => {
    for (const r of trashList) {
      insertRoad.run(r.id, datasetId, r.sr_no, r.fid, r.name,
        r.from_chainage, r.to_chainage, r.length, r.width,
        r.road_type, r.contractor, r.construction_date,
        r.maintenance_date, r.last_repair, r.surface_material,
        r.drainage_type, r.zone, r.ward_no, r.status,
        r.remarks, r.geometry);
    }
    db.prepare('DELETE FROM trash WHERE dataset_id = ?').run(datasetId);
  });
  restoreTx();

  // Update count
  db.prepare('UPDATE datasets SET road_count = (SELECT COUNT(*) FROM roads WHERE dataset_id = ?) WHERE id = ?').run(datasetId, datasetId);

  // History
  db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(datasetId, 'SYSTEM', 'Trash', 'Restore All', `${trashList.length} roads`, 'All trashed roads restored', req.user?.username || 'system');

  res.json({ success: true, count: trashList.length });
});

// DELETE /api/trash/:datasetId/:id — permanent delete
router.delete('/:datasetId/:id', requireSuperAdmin, (req, res) => {
  const datasetId = parseInt(req.params.datasetId);
  const { id } = req.params;

  const trashed = db.prepare('SELECT * FROM trash WHERE id = ? AND dataset_id = ?').get(id, datasetId);
  if (!trashed) return res.status(404).json({ error: 'Not found in trash' });

  db.prepare('DELETE FROM trash WHERE id = ? AND dataset_id = ?').run(id, datasetId);

  db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(datasetId, id, trashed.name || '', 'Permanently Deleted', trashed.name || '', 'Road permanently removed', req.user?.username || 'system');

  res.json({ success: true });
});

// DELETE /api/trash/:datasetId — empty all trash for dataset
router.delete('/:datasetId', requireSuperAdmin, (req, res) => {
  const datasetId = parseInt(req.params.datasetId);
  const count = db.prepare('SELECT COUNT(*) as c FROM trash WHERE dataset_id = ?').get(datasetId).c;

  db.prepare('DELETE FROM trash WHERE dataset_id = ?').run(datasetId);

  db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(datasetId, 'SYSTEM', 'Trash', 'Emptied Trash', `${count} roads`, 'All trashed roads permanently removed', req.user?.username || 'system');

  res.json({ success: true });
});

module.exports = router;
