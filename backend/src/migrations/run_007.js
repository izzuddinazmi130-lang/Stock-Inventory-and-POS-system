const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'hq_inventory_system',
      multipleStatements: true
    });

    console.log('Connected to database. Running migration 007...');
    const sql = fs.readFileSync(path.join(__dirname, '007_damage_reports.sql'), 'utf8');
    await conn.query(sql);
    console.log('[OK] Migration 007 complete: damage_reports and damage_report_photos created.');
  } catch(e) {
    console.error('Migration error:', e.message);
  } finally {
    if (conn) await conn.end();
  }
}
run();
