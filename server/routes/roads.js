const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Helper: convert DB row to client road object
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
  };
}

// GET /api/roads — paginated, filtered, searchable
router.get('/', (req, res) => {
  const { page = 1, limit = 50, type, status, search, datasetId, zone, wardNo, sortField = 'sr_no', sortDir = 'asc' } = req.query;

  if (!datasetId) return res.status(400).json({ error: 'datasetId is required' });

  let where = ['dataset_id = ?'];
  let params = [parseInt(datasetId)];

  if (type && type !== 'All') { where.push('road_type = ?'); params.push(type); }
  if (status && status !== 'All') { where.push('status = ?'); params.push(status); }
  if (zone && zone !== 'All') { where.push('zone = ?'); params.push(zone); }
  if (wardNo) { where.push('ward_no = ?'); params.push(wardNo); }
  if (search) {
    where.push('(LOWER(name) LIKE ? OR LOWER(id) LIKE ? OR LOWER(zone) LIKE ? OR LOWER(contractor) LIKE ?)');
    const q = `%${search.toLowerCase()}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.join(' AND ');

  // Validate sort field to prevent SQL injection
  const validSortFields = { sr_no: 'sr_no', name: 'name', road_type: 'road_type', length: 'length', width: 'width', status: 'status', zone: 'zone', ward_no: 'ward_no', srNo: 'sr_no', roadType: 'road_type', wardNo: 'ward_no' };
  const dbSortField = validSortFields[sortField] || 'sr_no';
  const dbSortDir = sortDir === 'desc' ? 'DESC' : 'ASC';

  const total = db.prepare(`SELECT COUNT(*) as c FROM roads WHERE ${whereClause}`).get(...params).c;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const rows = db.prepare(
    `SELECT * FROM roads WHERE ${whereClause} ORDER BY ${dbSortField} ${dbSortDir} LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit), offset);

  res.json({
    roads: rows.map(rowToRoad),
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
});

// GET /api/roads/all/:datasetId — get ALL roads for a dataset (map view)
router.get('/all/:datasetId', (req, res) => {
  const rows = db.prepare('SELECT * FROM roads WHERE dataset_id = ? ORDER BY sr_no ASC').all(parseInt(req.params.datasetId));
  res.json(rows.map(rowToRoad));
});

// GET /api/roads/single/:datasetId/:id — single road
router.get('/single/:datasetId/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM roads WHERE id = ? AND dataset_id = ?').get(req.params.id, parseInt(req.params.datasetId));
  if (!row) return res.status(404).json({ error: 'Road not found' });
  res.json(rowToRoad(row));
});

// POST /api/roads — create a new road
router.post('/', (req, res) => {
  const { datasetId, name, fromChainage, toChainage, length, width, roadType, contractor,
    constructionDate, maintenanceDate, lastRepair, surfaceMaterial, drainageType,
    zone, wardNo, status, remarks, geometry } = req.body;

  if (!datasetId) return res.status(400).json({ error: 'datasetId is required' });

  // Generate next ID
  const maxRow = db.prepare('SELECT MAX(sr_no) as max_sr FROM roads WHERE dataset_id = ?').get(parseInt(datasetId));
  const nextSr = (maxRow?.max_sr || 0) + 1;
  const id = `RD-${String(nextSr).padStart(4, '0')}`;

  db.prepare(`
    INSERT INTO roads (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
      length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
      surface_material, drainage_type, zone, ward_no, status, remarks, geometry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, parseInt(datasetId), nextSr, nextSr, name || '', fromChainage || 0, toChainage || 0,
    length || 0, width || 0, roadType || '', contractor || '', constructionDate || '',
    maintenanceDate || '', lastRepair || '', surfaceMaterial || '', drainageType || '',
    zone || '', wardNo || '', status || 'Good', remarks || '', JSON.stringify(geometry || {}));

  // Update dataset road count
  db.prepare('UPDATE datasets SET road_count = (SELECT COUNT(*) FROM roads WHERE dataset_id = ?) WHERE id = ?').run(parseInt(datasetId), parseInt(datasetId));

  // Add history entry
  db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(parseInt(datasetId), id, name || '', 'Created', '', 'New road added', req.user?.username || 'system');

  const road = db.prepare('SELECT * FROM roads WHERE id = ? AND dataset_id = ?').get(id, parseInt(datasetId));
  res.json({ success: true, road: rowToRoad(road) });
});

// PUT /api/roads/:datasetId/:id — update road attributes
router.put('/:datasetId/:id', (req, res) => {
  const { id } = req.params;
  const datasetId = parseInt(req.params.datasetId);

  const existing = db.prepare('SELECT * FROM roads WHERE id = ? AND dataset_id = ?').get(id, datasetId);
  if (!existing) return res.status(404).json({ error: 'Road not found' });

  const updates = req.body;
  const editedBy = req.user?.username || 'system';

  // Map camelCase to snake_case
  const fieldMap = {
    name: 'name', fromChainage: 'from_chainage', toChainage: 'to_chainage',
    length: 'length', width: 'width', roadType: 'road_type', contractor: 'contractor',
    constructionDate: 'construction_date', maintenanceDate: 'maintenance_date',
    lastRepair: 'last_repair', surfaceMaterial: 'surface_material',
    drainageType: 'drainage_type', zone: 'zone', wardNo: 'ward_no',
    status: 'status', remarks: 'remarks', srNo: 'sr_no',
  };

  const setClauses = [];
  const values = [];

  for (const [camelKey, val] of Object.entries(updates)) {
    if (camelKey === 'geometry' || camelKey === 'id' || camelKey === 'datasetId') continue;
    const dbKey = fieldMap[camelKey];
    if (!dbKey) continue;

    const oldVal = existing[dbKey];
    if (String(oldVal) !== String(val)) {
      // Record history
      db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(datasetId, id, existing.name || '', camelKey, String(oldVal ?? ''), String(val ?? ''), editedBy);
    }

    setClauses.push(`${dbKey} = ?`);
    values.push(val);
  }

  if (setClauses.length > 0) {
    setClauses.push('updated_at = datetime(\'now\')');
    values.push(id, datasetId);
    db.prepare(`UPDATE roads SET ${setClauses.join(', ')} WHERE id = ? AND dataset_id = ?`).run(...values);
  }

  const road = db.prepare('SELECT * FROM roads WHERE id = ? AND dataset_id = ?').get(id, datasetId);
  res.json({ success: true, road: rowToRoad(road) });
});

// DELETE /api/roads/:datasetId/:id — soft delete (move to trash)
router.delete('/:datasetId/:id', (req, res) => {
  const { id } = req.params;
  const datasetId = parseInt(req.params.datasetId);

  const road = db.prepare('SELECT * FROM roads WHERE id = ? AND dataset_id = ?').get(id, datasetId);
  if (!road) return res.status(404).json({ error: 'Road not found' });

  const editedBy = req.user?.username || 'system';

  // Move to trash
  db.prepare(`
    INSERT INTO trash (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
      length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
      surface_material, drainage_type, zone, ward_no, status, remarks, geometry, deleted_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(road.id, datasetId, road.sr_no, road.fid, road.name,
    road.from_chainage, road.to_chainage, road.length, road.width,
    road.road_type, road.contractor, road.construction_date,
    road.maintenance_date, road.last_repair, road.surface_material,
    road.drainage_type, road.zone, road.ward_no, road.status,
    road.remarks, road.geometry, editedBy);

  // Remove from roads
  db.prepare('DELETE FROM roads WHERE id = ? AND dataset_id = ?').run(id, datasetId);

  // Update count
  db.prepare('UPDATE datasets SET road_count = (SELECT COUNT(*) FROM roads WHERE dataset_id = ?) WHERE id = ?').run(datasetId, datasetId);

  // History
  db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(datasetId, id, road.name || '', 'Moved to Trash', road.name || '', 'Road moved to trash (recoverable)', editedBy);

  res.json({ success: true });
});

module.exports = router;
