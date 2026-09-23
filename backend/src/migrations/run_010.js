const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'hq_inventory_system',
      multipleStatements: true
    });

    const sql = fs.readFileSync(path.join(__dirname, '010_business_form_config.sql'), 'utf8');
    await connection.query(sql);
    console.log('[OK] Migration 010 complete: business form configuration created and seeded.');
  } catch (error) {
    console.error('[ERROR] Migration 010 failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

run();