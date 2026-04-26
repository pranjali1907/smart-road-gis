const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Try loading .env from server directory first, then root
const serverEnv = path.join(__dirname, '..', '.env');
const rootEnv = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(serverEnv)) require('dotenv').config({ path: serverEnv });
else if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'smartroad.db');

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
