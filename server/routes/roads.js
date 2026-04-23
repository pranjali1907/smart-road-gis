const express = require('express');
const db = require('../db/connection');
const ExcelJS = require('exceljs');

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

// GET /api/roads/export — Export attribute table as Excel
router.get('/export', async (req, res) => {
  const { datasetId } = req.query;
  if (!datasetId) return res.status(400).json({ error: 'datasetId is required' });

  const rows = db.prepare(
    'SELECT * FROM roads WHERE dataset_id = ? ORDER BY sr_no ASC'
  ).all(parseInt(datasetId));

  const dataset = db.prepare('SELECT name FROM datasets WHERE id = ?').get(parseInt(datasetId));
  const datasetName = dataset?.name || 'Dataset';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Road GIS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attribute Table', {
    headerFooter: { firstHeader: `Smart Road GIS — ${datasetName} Attribute Table` },
  });

  sheet.columns = [
    { header: 'Sr. No.', key: 'srNo', width: 8 },
    { header: 'Road ID', key: 'id', width: 12 },
    { header: 'Road Name', key: 'name', width: 30 },
    { header: 'Type', key: 'roadType', width: 18 },
    { header: 'From Chainage', key: 'fromChainage', width: 14 },
    { header: 'To Chainage', key: 'toChainage', width: 14 },
    { header: 'Length (km)', key: 'length', width: 12 },
    { header: 'Width (m)', key: 'width', width: 10 },
    { header: 'Surface Material', key: 'surfaceMaterial', width: 18 },
    { header: 'Drainage Type', key: 'drainageType', width: 16 },
    { header: 'Zone', key: 'zone', width: 14 },
    { header: 'Ward No.', key: 'wardNo', width: 10 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Contractor', key: 'contractor', width: 25 },
    { header: 'Construction Date', key: 'constructionDate', width: 18 },
    { header: 'Maintenance Date', key: 'maintenanceDate', width: 18 },
    { header: 'Last Repair', key: 'lastRepair', width: 14 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];

  // Header row style
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 28;

  // Data rows
  rows.forEach((row, idx) => {
    const r = sheet.addRow({
      srNo: row.sr_no,
      id: row.id,
      name: row.name || '',
      roadType: row.road_type || '',
      fromChainage: row.from_chainage ?? '',
      toChainage: row.to_chainage ?? '',
      length: row.length ?? '',
      width: row.width ?? '',
      surfaceMaterial: row.surface_material || '',
      drainageType: row.drainage_type || '',
      zone: row.zone || '',
      wardNo: row.ward_no || '',
      status: row.status || '',
      contractor: row.contractor || '',
      constructionDate: row.construction_date || '',
      maintenanceDate: row.maintenance_date || '',
      lastRepair: row.last_repair || '',
      remarks: row.remarks || '',
    });
    if (idx % 2 === 1) {
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }
    r.alignment = { vertical: 'middle' };
  });

  // Borders
  sheet.eachRow(r => {
    r.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  sheet.autoFilter = { from: 'A1', to: `R${rows.length + 1}` };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Summary sheet
  const sumSheet = workbook.addWorksheet('Summary');
  sumSheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 35 },
  ];
  sumSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sumSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  sumSheet.addRow({ metric: 'Dataset', value: datasetName });
  sumSheet.addRow({ metric: 'Total Roads', value: rows.length });
  sumSheet.addRow({ metric: 'Export Date', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) });
  sumSheet.addRow({ metric: 'Exported By', value: req.user?.username || 'System' });

  const filename = `attribute_table_${datasetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

// ── GPKG helpers ──────────────────────────────────────────────────────────────

/** Write a little-endian double to a Buffer at offset */
function writeDoubleLE(buf, val, offset) {
  const tmp = Buffer.allocUnsafe(8);
  tmp.writeDoubleLe ? tmp.writeDoubleLE(val, 0) : tmp.writeDoubleBE(val, 0);
  try { buf.writeDoubleLE(val, offset); } catch (_) { buf.writeDoubleBE(val, offset); }
}

/** Convert a GeoJSON geometry object → GPKG binary blob (GPKG header + WKB) */
function geojsonToGpkgBlob(geom) {
  try {
    const parsed = typeof geom === 'string' ? JSON.parse(geom) : geom;
    if (!parsed || !parsed.type) return buildEmptyGpkg();

    let wkb;
    if (parsed.type === 'LineString' && Array.isArray(parsed.coordinates) && parsed.coordinates.length >= 2) {
      wkb = lineStringToWKB(parsed.coordinates);
    } else if (parsed.type === 'MultiLineString' && Array.isArray(parsed.coordinates) && parsed.coordinates.length >= 1) {
      // Use first line only for simplicity
      wkb = lineStringToWKB(parsed.coordinates[0]);
    } else {
      return buildEmptyGpkg();
    }

    // GPKG Binary Header (8 bytes): magic(2) + version(1) + flags(1) + srs_id(4)
    const header = Buffer.alloc(8);
    header[0] = 0x47; // 'G'
    header[1] = 0x50; // 'P'
    header[2] = 0x00; // version 1
    header[3] = 0x01; // flags: little-endian, no envelope, not empty
    header.writeInt32LE(4326, 4); // SRS ID = WGS84
    return Buffer.concat([header, wkb]);
  } catch {
    return buildEmptyGpkg();
  }
}

function buildEmptyGpkg() {
  const header = Buffer.alloc(8);
  header[0] = 0x47; header[1] = 0x50; header[2] = 0x00;
  header[3] = 0x21; // flags: empty geometry bit set
  header.writeInt32LE(4326, 4);
  return header;
}

/** Encode a LineString as WKB (ISO WKB, little-endian) */
function lineStringToWKB(coords) {
  const n = coords.length;
  // 1 (byte order) + 4 (type) + 4 (numPoints) + n*16 (each point = 2 doubles)
  const buf = Buffer.alloc(1 + 4 + 4 + n * 16);
  let o = 0;
  buf.writeUInt8(1, o); o += 1;           // little-endian
  buf.writeUInt32LE(2, o); o += 4;        // WKB type = LineString (2)
  buf.writeUInt32LE(n, o); o += 4;        // numPoints
  for (const [x, y] of coords) {
    buf.writeDoubleLE(Number(x) || 0, o); o += 8;
    buf.writeDoubleLE(Number(y) || 0, o); o += 8;
  }
  return buf;
}

// GET /api/roads/export-gpkg?datasetId=X — download as GeoPackage
router.get('/export-gpkg', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { datasetId } = req.query;
  if (!datasetId) return res.status(400).json({ error: 'datasetId is required' });

  const rows = db.prepare('SELECT * FROM roads WHERE dataset_id = ? ORDER BY sr_no ASC').all(parseInt(datasetId));
  const dataset = db.prepare('SELECT name FROM datasets WHERE id = ?').get(parseInt(datasetId));
  const datasetName = dataset?.name || 'roads';

  // Build GPKG as an in-memory SQLite database, then copy to a temp file
  const os = require('os');
  const path = require('path');
  const fs = require('fs');
  const Database = require('better-sqlite3');

  const tmpPath = path.join(os.tmpdir(), `roads_${datasetId}_${Date.now()}.gpkg`);
  const gpkg = new Database(tmpPath);

  // Required GPKG tables
  gpkg.exec(`
    PRAGMA application_id = 1196444487;
    PRAGMA user_version = 10200;

    CREATE TABLE gpkg_spatial_ref_sys (
      srs_name TEXT NOT NULL,
      srs_id INTEGER NOT NULL PRIMARY KEY,
      organization TEXT NOT NULL,
      organization_coordsys_id INTEGER NOT NULL,
      definition TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE gpkg_contents (
      table_name TEXT NOT NULL PRIMARY KEY,
      data_type TEXT NOT NULL,
      identifier TEXT,
      description TEXT DEFAULT '',
      last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
      min_x REAL, min_y REAL, max_x REAL, max_y REAL,
      srs_id INTEGER,
      CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
    );

    CREATE TABLE gpkg_geometry_columns (
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      geometry_type_name TEXT NOT NULL,
      srs_id INTEGER NOT NULL,
      z TINYINT NOT NULL DEFAULT 0,
      m TINYINT NOT NULL DEFAULT 0,
      CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
      CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
      CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
    );
  `);

  // Insert WGS84 SRS
  gpkg.prepare(`
    INSERT INTO gpkg_spatial_ref_sys (srs_name, srs_id, organization, organization_coordsys_id, definition, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'WGS 84 geographic 2D', 4326, 'EPSG', 4326,
    'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]',
    'longitude/latitude coordinates in decimal degrees'
  );

  // Create the roads feature table
  gpkg.exec(`
    CREATE TABLE roads (
      fid INTEGER PRIMARY KEY AUTOINCREMENT,
      geom BLOB,
      road_id TEXT,
      sr_no INTEGER,
      name TEXT,
      road_type TEXT,
      from_chainage REAL,
      to_chainage REAL,
      length REAL,
      width REAL,
      surface_material TEXT,
      drainage_type TEXT,
      zone TEXT,
      ward_no TEXT,
      status TEXT,
      contractor TEXT,
      construction_date TEXT,
      last_repair TEXT,
      remarks TEXT
    );
  `);

  // Register in gpkg_contents
  gpkg.prepare(`
    INSERT INTO gpkg_contents (table_name, data_type, identifier, description, srs_id)
    VALUES ('roads', 'features', ?, ?, 4326)
  `).run(datasetName, `Roads exported from Smart Road GIS — ${datasetName}`);

  gpkg.prepare(`
    INSERT INTO gpkg_geometry_columns (table_name, column_name, geometry_type_name, srs_id, z, m)
    VALUES ('roads', 'geom', 'LINESTRING', 4326, 0, 0)
  `).run();

  // Insert road rows
  const insert = gpkg.prepare(`
    INSERT INTO roads (geom, road_id, sr_no, name, road_type, from_chainage, to_chainage,
      length, width, surface_material, drainage_type, zone, ward_no, status,
      contractor, construction_date, last_repair, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = gpkg.transaction((roadRows) => {
    for (const row of roadRows) {
      const blob = geojsonToGpkgBlob(row.geometry);
      insert.run(
        blob, row.id, row.sr_no, row.name || '',
        row.road_type || '', row.from_chainage || 0, row.to_chainage || 0,
        row.length || 0, row.width || 0,
        row.surface_material || '', row.drainage_type || '',
        row.zone || '', row.ward_no || '', row.status || 'Good',
        row.contractor || '', row.construction_date || '',
        row.last_repair || '', row.remarks || ''
      );
    }
  });
  insertAll(rows);
  gpkg.close();

  const safeDate = new Date().toISOString().split('T')[0];
  const fname = `${datasetName.replace(/\s+/g, '_')}_${safeDate}.gpkg`;

  res.setHeader('Content-Type', 'application/geopackage+sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

  const stream = fs.createReadStream(tmpPath);
  stream.pipe(res);
  stream.on('end', () => { try { fs.unlinkSync(tmpPath); } catch (_) {} });
  stream.on('error', () => { try { fs.unlinkSync(tmpPath); } catch (_) {} res.status(500).end(); });
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
  const geometryStr = typeof road.geometry === 'string' ? road.geometry : JSON.stringify(road.geometry || {});

  try {
    const trashTx = db.transaction(() => {
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
        road.remarks, geometryStr, editedBy);

      // Remove from roads
      db.prepare('DELETE FROM roads WHERE id = ? AND dataset_id = ?').run(id, datasetId);

      // Update count
      db.prepare('UPDATE datasets SET road_count = (SELECT COUNT(*) FROM roads WHERE dataset_id = ?) WHERE id = ?').run(datasetId, datasetId);

      // History
      db.prepare('INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(datasetId, id, road.name || '', 'Moved to Trash', road.name || '', 'Road moved to trash (recoverable)', editedBy);
    });

    trashTx();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete transaction failed:', err);
    res.status(500).json({ error: 'Failed to move road to trash' });
  }
});

module.exports = router;
