const express = require('express');
const db = require('../db/connection');
const { requireSuperAdmin } = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');
const wkx = require('wkx');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

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

// POST /api/datasets/parse-gpkg — upload and parse a .gpkg file to GeoJSON
router.post('/parse-gpkg', requireSuperAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const gpkg = new Database(req.file.path, { readonly: true });
    
    // Find the features table
    const contents = gpkg.prepare("SELECT table_name FROM gpkg_contents WHERE data_type = 'features'").all();
    if (contents.length === 0) {
      throw new Error('No feature tables found in GeoPackage');
    }
    
    const tableName = contents[0].table_name;
    
    // Find geometry column
    const geomCols = gpkg.prepare("SELECT column_name FROM gpkg_geometry_columns WHERE table_name = ?").get(tableName);
    const geomCol = geomCols ? geomCols.column_name : 'geom';

    const rows = gpkg.prepare(`SELECT * FROM "${tableName}"`).all();
    
    const features = [];
    
    for (const row of rows) {
      const properties = { ...row };
      let geometry = null;
      
      if (row[geomCol]) {
        // Parse GPKG binary
        const buffer = row[geomCol];
        // Header starts with 'GP' (0x47, 0x50), then version (0x00)
        if (buffer[0] === 0x47 && buffer[1] === 0x50) {
          const flags = buffer[3];
          // Determine header length based on envelope indicator in flags
          const envInd = (flags >> 1) & 0x07;
          let headerLen = 8;
          if (envInd === 1) headerLen += 32;
          else if (envInd === 2 || envInd === 3) headerLen += 48;
          else if (envInd === 4) headerLen += 64;
          
          const wkbBuffer = buffer.slice(headerLen);
          try {
            geometry = wkx.Geometry.parse(wkbBuffer).toGeoJSON();
          } catch(e) {
             console.log("wkx parse error:", e.message);
          }
        }
      }
      delete properties[geomCol];
      
      features.push({
        type: 'Feature',
        properties,
        geometry: geometry || { type: 'LineString', coordinates: [] }
      });
    }
    
    gpkg.close();
    fs.unlinkSync(req.file.path);
    
    res.json({ type: 'FeatureCollection', features });
    
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets/upload-import — upload and import a dataset directly on the server (super admin only)
router.post('/upload-import', requireSuperAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const mode = req.body.mode || 'replace'; // 'replace' | 'append'
  let datasetId = req.body.datasetId ? parseInt(req.body.datasetId) : null;

  try {
    const filename = req.file.originalname.toLowerCase();
    let features = [];

    if (filename.endsWith('.geojson') || filename.endsWith('.json')) {
      const text = fs.readFileSync(req.file.path, 'utf8');
      const geojson = JSON.parse(text);
      if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        features = geojson.features;
      } else if (geojson.type === 'Feature') {
        features = [geojson];
      } else {
        throw new Error('Invalid GeoJSON: expected FeatureCollection or Feature');
      }
    } else if (filename.endsWith('.zip')) {
      global.self = global;
      const shpModule = await import('shpjs');
      const buffer = fs.readFileSync(req.file.path);
      const geojson = await shpModule.default(buffer);
      if (Array.isArray(geojson)) {
        geojson.forEach(fc => {
          if (fc.features) features.push(...fc.features);
        });
      } else if (geojson.features) {
        features = geojson.features;
      }
    } else if (filename.endsWith('.gpkg')) {
      const gpkg = new Database(req.file.path, { readonly: true });
      const contents = gpkg.prepare("SELECT table_name FROM gpkg_contents WHERE data_type = 'features'").all();
      if (contents.length === 0) {
        throw new Error('No feature tables found in GeoPackage');
      }
      const tableName = contents[0].table_name;
      const geomCols = gpkg.prepare("SELECT column_name FROM gpkg_geometry_columns WHERE table_name = ?").get(tableName);
      const geomCol = geomCols ? geomCols.column_name : 'geom';
      const rows = gpkg.prepare(`SELECT * FROM "${tableName}"`).all();
      for (const row of rows) {
        const properties = { ...row };
        let geometry = null;
        if (row[geomCol]) {
          const buffer = row[geomCol];
          if (buffer[0] === 0x47 && buffer[1] === 0x50) {
            const flags = buffer[3];
            const envInd = (flags >> 1) & 0x07;
            let headerLen = 8;
            if (envInd === 1) headerLen += 32;
            else if (envInd === 2 || envInd === 3) headerLen += 48;
            else if (envInd === 4) headerLen += 64;
            const wkbBuffer = buffer.slice(headerLen);
            try {
              geometry = wkx.Geometry.parse(wkbBuffer).toGeoJSON();
            } catch (e) {
              console.log("wkx parse error:", e.message);
            }
          }
        }
        delete properties[geomCol];
        features.push({
          type: 'Feature',
          properties,
          geometry: geometry || { type: 'LineString', coordinates: [] }
        });
      }
      gpkg.close();
    } else {
      throw new Error('Unsupported file extension');
    }

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (features.length === 0) {
      throw new Error('No features found in the uploaded file');
    }

    // Determine dataset target
    if (!datasetId) {
      const datasetName = req.body.name || req.file.originalname.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      const desc = req.body.description || `Uploaded from ${req.file.originalname}`;
      const result = db.prepare(
        'INSERT INTO datasets (name, description, uploaded_by) VALUES (?, ?, ?)'
      ).run(datasetName, desc, req.user?.username || 'superadmin');
      datasetId = result.lastInsertRowid;
    } else {
      const dataset = db.prepare('SELECT id FROM datasets WHERE id = ?').get(datasetId);
      if (!dataset) {
        throw new Error('Target dataset not found');
      }
    }

    // Convert features to road models
    const roads = features.map((feat, i) => {
      const props = feat.properties || {};
      const get = (...keys) => {
        for (const key of keys) {
          if (props[key] !== undefined && props[key] !== null) return props[key];
          const lower = key.toLowerCase();
          const found = Object.keys(props).find(k => k.toLowerCase() === lower);
          if (found && props[found] !== undefined && props[found] !== null) return props[found];
        }
        return undefined;
      };
      const getByPrefix = (...prefixes) => {
        for (const prefix of prefixes) {
          const lower = prefix.toLowerCase();
          const found = Object.keys(props).find(k => k.toLowerCase().startsWith(lower));
          if (found && props[found] !== undefined && props[found] !== null) return props[found];
        }
        return undefined;
      };

      const srNo = get('srNo', 'sr_no', 'SR_NO', 'sr.no', 'serial') ?? i + 1;
      const fid = get('fid', 'FID') ?? i + 1;
      const roadId = `RD-${String(fid || i + 1).padStart(6, '0')}`;
      const name = get('name', 'NAME', 'road_name', 'ROAD_NAME', 'road name') || '';
      const fromChainage = parseFloat(get('from_ch', 'FROM_CH', 'fromChainage', 'from_chainage') ?? getByPrefix('from china', 'from ch') ?? 0) || 0;
      const toChainage = parseFloat(get('to_ch', 'TO_CH', 'toChainage', 'to_chainage') ?? getByPrefix('to china', 'to ch') ?? 0) || 0;
      const length = parseFloat(get('length', 'LENGTH', 'len') ?? getByPrefix('total leng') ?? 0) || 0;
      const width = parseFloat(get('width', 'WIDTH') ?? 0) || 0;
      const roadType = get('roadType', 'road_type', 'ROAD_TYPE', 'type', 'TYPE', 'road type') || '';
      const contractor = get('contractor', 'CONTRACTOR') || '';
      const constructionDate = String(get('constructionDate', 'construction_date', 'CONSTRUCTION_DATE', 'year') ?? getByPrefix('y construc') ?? '');
      const maintenanceDate = String(get('maintenanceDate', 'maintenance_date') ?? getByPrefix('maintainan', 'maintenan') ?? '');
      const lastRepair = String(get('lastRepair', 'last_repair') ?? getByPrefix('la repair', 'last rep') ?? '');
      const surfaceMaterial = get('surfaceMaterial', 'surface', 'SURFACE', 'material', 'surface_material') ?? getByPrefix('sur materi') ?? '';
      const drainageType = get('drainageType', 'drainage', 'DRAINAGE', 'drainage_type') ?? getByPrefix('drinage ty', 'drainage t') ?? '';
      const dividerOnRoad = get('dividerOnRoad', 'divider_on_road', 'divider') ?? getByPrefix('divider') ?? 'No';
      const numberOfLanes = parseInt(get('numberOfLanes', 'number_of_lanes', 'lanes') ?? getByPrefix('number of') ?? 2) || 2;
      const zone = String(get('zone', 'ZONE') ?? '');
      const wardNo = String(get('wardNo', 'ward', 'WARD', 'ward_no', 'ward no') ?? '');
      const status = get('status', 'STATUS') || 'Good';
      const remarks = get('remarks', 'REMARKS', 'remark') || '';

      return {
        id: String(roadId),
        srNo,
        fid,
        name,
        fromChainage,
        toChainage,
        length,
        width,
        roadType,
        contractor,
        constructionDate,
        maintenanceDate,
        lastRepair,
        surfaceMaterial,
        drainageType,
        dividerOnRoad: String(dividerOnRoad),
        numberOfLanes,
        zone,
        wardNo,
        status,
        remarks,
        geometry: feat.geometry || { type: 'LineString', coordinates: [] },
      };
    });

    if (mode === 'replace') {
      db.prepare('DELETE FROM roads WHERE dataset_id = ?').run(datasetId);
    }

    const insertRoad = db.prepare(`
      INSERT OR REPLACE INTO roads (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
        length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
        surface_material, drainage_type, divider_on_road, number_of_lanes, zone, ward_no, status, remarks, geometry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const importTx = db.transaction((roadList) => {
      for (let i = 0; i < roadList.length; i++) {
        const r = roadList[i];
        insertRoad.run(
          r.id, datasetId, r.srNo, r.fid, r.name,
          r.fromChainage, r.toChainage, r.length, r.width,
          r.roadType, r.contractor, r.constructionDate,
          r.maintenanceDate, r.lastRepair, r.surfaceMaterial,
          r.drainageType, r.dividerOnRoad, r.numberOfLanes,
          r.zone, r.wardNo, r.status,
          r.remarks, JSON.stringify(r.geometry)
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

    const updatedDataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId);

    res.json({
      success: true,
      dataset: {
        id: updatedDataset.id,
        name: updatedDataset.name,
        description: updatedDataset.description,
        uploadedBy: updatedDataset.uploaded_by,
        roadCount: updatedDataset.road_count,
        createdAt: updatedDataset.created_at,
        isDefault: !!updatedDataset.is_default,
      },
      roadCount: count,
      importedCount: roads.length,
    });

  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Direct upload/import error:', err);
    res.status(500).json({ error: err.message });
  }
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
    INSERT OR REPLACE INTO roads (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
      length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
      surface_material, drainage_type, divider_on_road, number_of_lanes, zone, ward_no, status, remarks, geometry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        r.drainageType || '', r.dividerOnRoad || 'No', r.numberOfLanes || 2,
        r.zone || '', r.wardNo || '', r.status || 'Good',
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
