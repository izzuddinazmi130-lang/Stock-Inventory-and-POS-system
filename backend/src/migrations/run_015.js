// Migration 015: password resets.
//
//  - users.must_change_password  set when a Super Admin resets a password to a temporary one; the user must
//                                choose a new password after signing in before they can use the system.
//  - audit_logs                  earlier UPDATE_USER entries stored the whole user row, including the
//                                password hash. The hash is removed from those old entries.
//
// Safe to run more than once.  Usage (from backend/):  node src/migrations/run_015.js

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'hq_inventory_system',
  });
  try {
    const [cols] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'must_change_password'`
    );
    if (!cols[0].c) {
      // Appended at the end (no AFTER): a plain instant ADD COLUMN, no column reordering
      await conn.query('ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0');
      console.log('Added users.must_change_password');
    } else {
      console.log('users.must_change_password already exists');
    }

    const [scrubbed] = await conn.query(
      `UPDATE audit_logs SET old_values = JSON_REMOVE(old_values, '$.password_hash')
       WHERE old_values IS NOT NULL AND JSON_CONTAINS_PATH(old_values, 'one', '$.password_hash')`
    );
    console.log(`Removed password hashes from ${scrubbed.affectedRows} audit log entr${scrubbed.affectedRows === 1 ? 'y' : 'ies'}`);
  } finally {
    await conn.end();
  }
})().catch(err => { console.error('Migration 015 failed:', err.message); process.exit(1); });
