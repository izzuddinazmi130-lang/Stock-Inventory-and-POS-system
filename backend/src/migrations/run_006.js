// run_006.js — Migration runner for 006_payment_method.sql
// Adds payment_method ENUM column to stock_movements table.
// Database: hq_inventory_system (matches backend/src/config/db.js default)

const mysql = require('mysql2/promise');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'hq_inventory_system',
    });

    console.log('Connected to database. Running migration 006...');

    try {
      await conn.execute(
        `ALTER TABLE stock_movements ADD COLUMN payment_method ENUM('cash','qr','online_banking') NULL DEFAULT NULL`
      );
      console.log('[OK] Added payment_method column to stock_movements.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('[INFO] Column payment_method already exists - skipping.');
      } else {
        throw e;
      }
    }

    console.log('[OK] Migration 006 complete.');
  } finally {
    if (conn) await conn.end();
  }
}

run().catch(err => {
  console.error('[ERROR] Migration 006 failed:', err.message);
  process.exit(1);
});
