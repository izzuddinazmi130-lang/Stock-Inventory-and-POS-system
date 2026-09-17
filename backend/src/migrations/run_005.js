const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = await mysql.createConnection({
    host: '127.0.0.1', 
    user: 'root', 
    password: '', 
    database: 'hq_inventory_system'
  });
  const sql = fs.readFileSync(path.join(__dirname, '005_users_status.sql'), 'utf8');
  // Strip all comments
  const noComments = sql.replace(/--.*$/gm, '');
  const statements = noComments.split(';').map(s => s.trim()).filter(s => s);
  for (const stmt of statements) {
    try { 
      await pool.execute(stmt); 
      console.log('OK:', stmt.substring(0, 60)); 
    }
    catch(e) { 
      console.log('SKIP (already done?):', e.message.substring(0, 80)); 
    }
  }
  await pool.end();
  console.log('Migration 005 complete.');
}
run();
