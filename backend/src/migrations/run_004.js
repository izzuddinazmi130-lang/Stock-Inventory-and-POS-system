const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1', 
      user: process.env.DB_USER || 'root', 
      password: process.env.DB_PASS || '', 
      database: process.env.DB_NAME || 'hq_inventory_system',
      port: parseInt(process.env.DB_PORT || '3306'),
      multipleStatements: true
    });
    const sql = fs.readFileSync(path.join(__dirname, '004_products_master.sql'), 'utf8');
    await conn.query(sql);
    console.log('Migration 004 complete.');
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    if (conn) await conn.end();
  }
}
run();
