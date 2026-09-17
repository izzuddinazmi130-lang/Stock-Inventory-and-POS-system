const pool = require('../backend/src/config/db');

async function check() {
  try {
    const [userCols] = await pool.query('SHOW COLUMNS FROM users');
    console.log('USER COLS:', userCols.map(c => c.Field));

    const [users] = await pool.query('SELECT * FROM users');
    console.log('USERS:', users);

    const [products] = await pool.query('SELECT id, item_code, item_name, branch_id FROM stock_items');
    console.log('PRODUCTS:', products);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
