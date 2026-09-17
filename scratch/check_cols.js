const pool = require('../backend/src/config/db');

async function test() {
  try {
    console.log('--- DESCRIBE stock_items ---');
    const [cols] = await pool.query('DESCRIBE stock_items');
    console.log(cols);

    console.log('--- DESCRIBE stock_movements ---');
    const [smCols] = await pool.query('DESCRIBE stock_movements');
    console.log(smCols);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit();
  }
}

test();
