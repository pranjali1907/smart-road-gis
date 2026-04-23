/**
 * Smart Road GIS — Superadmin Setup Script
 * ─────────────────────────────────────────
 * Usage:
 *   node server/scripts/setup-superadmin.js
 *   node server/scripts/setup-superadmin.js --username=myname --password=MyPass@123 --email=admin@mc.gov.in
 *
 * Or set environment variables and run:
 *   SUPERADMIN_USERNAME=sangli_sa SUPERADMIN_PASSWORD=Pass@2026 node server/scripts/setup-superadmin.js
 *
 * This script directly updates the database — no server restart needed.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path  = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const readline = require('readline');

// ── Parse CLI args (--key=value) ─────────────────────────────────────────────
const args = {};
process.argv.slice(2).forEach(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  if (k && v !== undefined) args[k] = v;
});

// ── Resolve DB path ───────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || './server/data/smartroad.db';
const resolvedDb = path.resolve(process.cwd(), DB_PATH);

// ── Interactive prompts ────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def) => new Promise(res =>
  rl.question(`${q}${def ? ` [${def}]` : ''}: `, ans => res(ans.trim() || def || ''))
);
const askHidden = (q) => new Promise(res => {
  process.stdout.write(q + ': ');
  process.stdin.setRawMode?.(true);
  let pass = '';
  process.stdin.once('data', function handler(buf) {
    const str = buf.toString();
    if (str === '\r' || str === '\n') {
      process.stdin.setRawMode?.(false);
      process.stdout.write('\n');
      rl.resume();
      res(pass);
    } else if (str === '\u0003') { process.exit(); }
    else { pass += str; process.stdin.once('data', handler); }
  });
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
});

async function main() {
  console.log('\n  🔐 Smart Road GIS — Superadmin Setup\n  ─────────────────────────────────────\n');

  // Check DB exists
  const fs = require('fs');
  if (!fs.existsSync(resolvedDb)) {
    console.error(`  ✗ Database not found at: ${resolvedDb}`);
    console.error('  Start the server at least once to initialise the database first.');
    process.exit(1);
  }

  const db = new Database(resolvedDb);

  // Get current superadmin
  const current = db.prepare("SELECT * FROM users WHERE role='superadmin' LIMIT 1").get();
  if (current) {
    console.log(`  Current superadmin: ${current.username} (${current.email})\n`);
  } else {
    console.log('  No superadmin found — will create one.\n');
  }

  // Collect new credentials
  const username = args.username || await ask('  New username', current?.username || 'superadmin');
  const email    = args.email    || await ask('  New email',    current?.email    || 'super@smartroad.gov');
  const fullname = args.fullname || await ask('  Full name',    current?.full_name || 'Super Administrator');

  let password;
  if (args.password) {
    password = args.password;
    console.log('  Password: (from --password argument)');
  } else {
    console.log('');
    password = await ask('  New password (leave blank to keep current)', '');
    if (!password && current) {
      console.log('  → Password unchanged\n');
      password = null; // signal to not update
    }
  }

  rl.close();

  if (!username || !email) {
    console.error('\n  ✗ Username and email are required.\n');
    process.exit(1);
  }

  // Apply changes
  if (current) {
    const updates = { username, email, full_name: fullname };
    let sql = 'UPDATE users SET username=?, email=?, full_name=?';
    const params = [username, email, fullname];

    if (password) {
      const hashed = bcrypt.hashSync(password, 12);
      sql += ', password=?';
      params.push(hashed);
    }
    sql += ' WHERE id=?';
    params.push(current.id);

    db.prepare(sql).run(...params);
    console.log('\n  ✓ Superadmin updated successfully!');
  } else {
    if (!password) {
      console.error('\n  ✗ Password is required when creating a new superadmin.\n');
      process.exit(1);
    }
    const hashed = bcrypt.hashSync(password, 12);
    db.prepare(`
      INSERT INTO users (username, email, password, role, full_name)
      VALUES (?, ?, ?, 'superadmin', ?)
    `).run(username, email, hashed, fullname);
    console.log('\n  ✓ Superadmin created successfully!');
  }

  console.log(`\n  Username : ${username}`);
  console.log(`  Email    : ${email}`);
  console.log(`  Full name: ${fullname}`);
  console.log(`  Password : ${password ? '(updated)' : '(unchanged)'}`);
  console.log('\n  The server does NOT need to be restarted.\n');

  db.close();
  process.exit(0);
}

main().catch(err => { console.error('\n  ✗ Error:', err.message); process.exit(1); });
