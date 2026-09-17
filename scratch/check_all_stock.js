const pool = require('../backend/src/config/db');

async function test() {
  try {
    console.log('--- ALL STOCK ITEMS ---');
    const [items] = await pool.query('SELECT id, branch_id, warehouse_id, item_code, item_name, quantity, minimum_quantity, is_active FROM stock_items');
    console.log(items);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit();
  }
}

test();
