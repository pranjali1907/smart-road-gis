const db = require('./connection');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      uploaded_by TEXT NOT NULL,
      road_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS roads (
      id TEXT NOT NULL,
      dataset_id INTEGER NOT NULL,
      sr_no INTEGER,
      fid INTEGER,
      name TEXT DEFAULT '',
      from_chainage REAL DEFAULT 0,
      to_chainage REAL DEFAULT 0,
      length REAL DEFAULT 0,
      width REAL DEFAULT 0,
      road_type TEXT DEFAULT '',
      contractor TEXT DEFAULT '',
      construction_date TEXT DEFAULT '',
      maintenance_date TEXT DEFAULT '',
      last_repair TEXT DEFAULT '',
      surface_material TEXT DEFAULT '',
      drainage_type TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      ward_no TEXT DEFAULT '',
      status TEXT DEFAULT 'Good',
      remarks TEXT DEFAULT '',
      geometry TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (id, dataset_id),
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      full_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_id INTEGER,
      road_id TEXT,
      road_name TEXT DEFAULT '',
      field_name TEXT DEFAULT '',
      old_value TEXT DEFAULT '',
      new_value TEXT DEFAULT '',
      edited_by TEXT DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT DEFAULT '',
      action TEXT DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trash (
      id TEXT NOT NULL,
      dataset_id INTEGER NOT NULL,
      sr_no INTEGER,
      fid INTEGER,
      name TEXT DEFAULT '',
      from_chainage REAL DEFAULT 0,
      to_chainage REAL DEFAULT 0,
      length REAL DEFAULT 0,
      width REAL DEFAULT 0,
      road_type TEXT DEFAULT '',
      contractor TEXT DEFAULT '',
      construction_date TEXT DEFAULT '',
      maintenance_date TEXT DEFAULT '',
      last_repair TEXT DEFAULT '',
      surface_material TEXT DEFAULT '',
      drainage_type TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      ward_no TEXT DEFAULT '',
      status TEXT DEFAULT 'Good',
      remarks TEXT DEFAULT '',
      geometry TEXT DEFAULT '{}',
      deleted_by TEXT DEFAULT '',
      deleted_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (id, dataset_id),
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_roads_dataset ON roads(dataset_id);
    CREATE INDEX IF NOT EXISTS idx_roads_name ON roads(name);
    CREATE INDEX IF NOT EXISTS idx_roads_type ON roads(road_type);
    CREATE INDEX IF NOT EXISTS idx_roads_status ON roads(status);
    CREATE INDEX IF NOT EXISTS idx_roads_zone ON roads(zone);
    CREATE INDEX IF NOT EXISTS idx_history_dataset ON history(dataset_id);
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_trash_dataset ON trash(dataset_id);
  `);

  console.log('  ✓ Database schema initialized');

  // ── Always upsert the superadmin from environment variables ──────────────
  // This runs on EVERY server start so that changing .env + restarting
  // is all that's needed to rotate credentials for a new deployment.
  const SA_USERNAME  = process.env.SUPERADMIN_USERNAME  || 'superadmin';
  const SA_EMAIL     = process.env.SUPERADMIN_EMAIL     || 'super@smartroad.gov';
  const SA_PASSWORD  = process.env.SUPERADMIN_PASSWORD  || 'super123';
  const SA_FULLNAME  = process.env.SUPERADMIN_FULLNAME  || 'Super Administrator';

  const existing = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('superadmin');
  const hashed = bcrypt.hashSync(SA_PASSWORD, 12);

  if (existing) {
    // Update credentials of the existing superadmin
    db.prepare(`
      UPDATE users SET username=?, email=?, password=?, full_name=? WHERE id=?
    `).run(SA_USERNAME, SA_EMAIL, hashed, SA_FULLNAME, existing.id);
    console.log(`  ✓ Superadmin synced from .env (username: ${SA_USERNAME})`);
  } else {
    // First-ever start — create the superadmin
    db.prepare(`
      INSERT INTO users (username, email, password, role, full_name)
      VALUES (?, ?, ?, 'superadmin', ?)
    `).run(SA_USERNAME, SA_EMAIL, hashed, SA_FULLNAME);
    console.log(`  ✓ Superadmin created from .env (username: ${SA_USERNAME})`);
  }
}

function migrateExistingData() {
  const DATA_DIR = path.join(__dirname, '..', 'data');

  // Check if we already have users (skip migration if so)
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) {
    console.log('  ✓ Data already migrated, skipping');
    return;
  }

  console.log('  ⟳ Migrating existing data...');

  // Migrate users
  const USERS_FILE = path.join(DATA_DIR, 'users.json');
  let users = [
    { id: 1, username: 'admin', email: 'admin@smartroad.gov', password: 'admin123', role: 'admin', fullName: 'System Admin', createdAt: '2025-01-01T00:00:00Z' },
    { id: 2, username: 'user', email: 'user@smartroad.gov', password: 'user123', role: 'user', fullName: 'Regular User', createdAt: '2025-01-15T00:00:00Z' },
    { id: 3, username: 'superadmin', email: 'super@smartroad.gov', password: 'super123', role: 'superadmin', fullName: 'Super Admin', createdAt: '2025-01-01T00:00:00Z' },
  ];
  if (fs.existsSync(USERS_FILE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (stored.length > 0) users = stored;
    } catch {}
  }

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, email, password, role, full_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertUserTx = db.transaction((userList) => {
    for (const u of userList) {
      const hash = bcrypt.hashSync(u.password, 12);
      insertUser.run(u.username, u.email, hash, u.role, u.fullName || '', u.createdAt || new Date().toISOString());
    }
  });
  insertUserTx(users);
  console.log(`    ✓ ${users.length} users migrated (passwords hashed)`);

  // Create default dataset
  const res = db.prepare(`
    INSERT INTO datasets (name, description, uploaded_by, is_default)
    VALUES ('Default Dataset', 'Auto-migrated from initial data', 'system', 1)
  `).run();
  const datasetId = res.lastInsertRowid;
  console.log(`    ✓ Default dataset created (id=${datasetId})`);

  // Migrate roads from initial_roads.json if it exists
  const ROADS_JSON = path.join(DATA_DIR, 'initial_roads.json');
  if (fs.existsSync(ROADS_JSON)) {
    try {
      let rawData = JSON.parse(fs.readFileSync(ROADS_JSON, 'utf8'));
      let features = [];
      
      // Handle GeoJSON FeatureCollection
      if (rawData.type === 'FeatureCollection' && Array.isArray(rawData.features)) {
        features = rawData.features.map((f, i) => {
          const props = f.properties || {};
          return {
            id: props.id || props.ID || props.fid || `ROAD-${String(i+1).padStart(4, '0')}`,
            srNo: props.srNo || props['sr.no'] || props.sr_no || props.SR_NO || i + 1,
            fid: props.fid || props.FID || i + 1,
            name: (props.name || props.NAME || props.road_name || '').trim() || `Road in ${props.zone || props.ZONE || 'Unknown'}${props.wardNo || props.ward || props.WARD ? ' Ward ' + (props.wardNo || props.ward || props.WARD) : ''} (#${props.srNo || props['sr.no'] || props.sr_no || props.SR_NO || i + 1})`,
            fromChainage: parseFloat(props.from_ch || props.FROM_CH || props.fromChainage || 0) || 0,
            toChainage: parseFloat(props.to_ch || props.TO_CH || props.toChainage || 0) || 0,
            length: parseFloat(props.length || props.LENGTH || 0) || 0,
            width: parseFloat(props.width || props.WIDTH || 0) || 0,
            roadType: props.roadType || props.road_type || props.type || '',
            contractor: props.contractor || props.CONTRACTOR || '',
            constructionDate: props.constructionDate || props.construction_date || props.year || '',
            maintenanceDate: props.maintenanceDate || props.maintenance_date || '',
            lastRepair: props.lastRepair || props.last_repair || '',
            surfaceMaterial: props.surfaceMaterial || props.surface || props.material || '',
            drainageType: props.drainageType || props.drainage || '',
            zone: props.zone || props.ZONE || '',
            wardNo: props.wardNo || props.ward || props.WARD || '',
            status: props.status || props.STATUS || 'Good',
            remarks: props.remarks || props.REMARKS || '',
            geometry: f.geometry || { type: 'LineString', coordinates: [] }
          };
        });
      } else if (Array.isArray(rawData)) {
        features = rawData;
      }

      const insertRoad = db.prepare(`
        INSERT OR IGNORE INTO roads (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
          length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
          surface_material, drainage_type, zone, ward_no, status, remarks, geometry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertRoadsTx = db.transaction((roads) => {
        for (const r of roads) {
          insertRoad.run(
            String(r.id), datasetId, r.srNo || 0, r.fid || 0, r.name || '',
            r.fromChainage || 0, r.toChainage || 0, r.length || 0, r.width || 0,
            r.roadType || '', r.contractor || '', r.constructionDate || '',
            r.maintenanceDate || '', r.lastRepair || '', r.surfaceMaterial || '',
            r.drainageType || '', r.zone || '', r.wardNo || '', r.status || 'Good',
            r.remarks || '', JSON.stringify(r.geometry || {})
          );
        }
      });
      insertRoadsTx(features);

      // Update road count
      db.prepare('UPDATE datasets SET road_count = ? WHERE id = ?').run(features.length, datasetId);
      console.log(`    ✓ ${features.length} roads migrated into default dataset`);
    } catch (err) {
      console.error('    ✗ Road migration error:', err.message);
    }
  } else {
    console.log('    ⚠ No initial_roads.json found — upload a dataset via the UI');
  }

  // Migrate history
  const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const historyData = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      const insertHistory = db.prepare(`
        INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertHistoryTx = db.transaction((entries) => {
        for (const e of entries) {
          insertHistory.run(datasetId, e.roadId || '', e.roadName || '', e.fieldName || '',
            e.oldValue || '', e.newValue || '', e.editedBy || '', e.timestamp || new Date().toISOString());
        }
      });
      insertHistoryTx(historyData);
      console.log(`    ✓ ${historyData.length} history entries migrated`);
    } catch {}
  }

  // Migrate activity
  const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');
  if (fs.existsSync(ACTIVITY_FILE)) {
    try {
      const activityData = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
      const insertActivity = db.prepare(`
        INSERT INTO activity (user_id, username, action, timestamp) VALUES (?, ?, ?, ?)
      `);
      const insertActivityTx = db.transaction((entries) => {
        for (const e of entries) {
          insertActivity.run(e.userId || 0, e.username || '', e.action || '', e.timestamp || new Date().toISOString());
        }
      });
      insertActivityTx(activityData);
      console.log(`    ✓ ${activityData.length} activity entries migrated`);
    } catch {}
  }

  // Migrate trash
  const TRASH_FILE = path.join(DATA_DIR, 'trash.json');
  if (fs.existsSync(TRASH_FILE)) {
    try {
      const trashData = JSON.parse(fs.readFileSync(TRASH_FILE, 'utf8'));
      if (trashData.length > 0) {
        const insertTrash = db.prepare(`
          INSERT OR IGNORE INTO trash (id, dataset_id, sr_no, fid, name, from_chainage, to_chainage,
            length, width, road_type, contractor, construction_date, maintenance_date, last_repair,
            surface_material, drainage_type, zone, ward_no, status, remarks, geometry, deleted_by, deleted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertTrashTx = db.transaction((entries) => {
          for (const r of entries) {
            insertTrash.run(
              r.id, datasetId, r.srNo || 0, r.fid || 0, r.name || '',
              r.fromChainage || 0, r.toChainage || 0, r.length || 0, r.width || 0,
              r.roadType || '', r.contractor || '', r.constructionDate || '',
              r.maintenanceDate || '', r.lastRepair || '', r.surfaceMaterial || '',
              r.drainageType || '', r.zone || '', r.wardNo || '', r.status || 'Good',
              r.remarks || '', JSON.stringify(r.geometry || {}),
              r._deletedBy || '', r._deletedAt || new Date().toISOString()
            );
          }
        });
        insertTrashTx(trashData);
        console.log(`    ✓ ${trashData.length} trash entries migrated`);
      }
    } catch {}
  }
}

module.exports = { initSchema, migrateExistingData };
