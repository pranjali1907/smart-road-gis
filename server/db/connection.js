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
try {
  if (!fs.existsSync(dir)) {
    console.log(`  ➜  Creating data directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (err) {
  console.error(`  ✗ Error creating data directory ${dir}:`, err.message);
  // If it's a permission error at root, try falling back to local data folder
  if (err.code === 'EACCES' && dir.startsWith('/')) {
    const fallback = path.join(__dirname, '..', 'data');
    console.log(`  ➜  Falling back to local data directory: ${fallback}`);
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    // Note: This won't change DB_PATH itself, but ensures the process continues
    // if the user provided an unreachable path but the DB initialization can handle it.
  }
}

const db = new Database(DB_PATH);

// Enable WAL mode for concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
