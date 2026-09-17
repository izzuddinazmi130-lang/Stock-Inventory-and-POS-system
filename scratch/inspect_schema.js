const pool = require('../backend/src/config/db');

async function inspect() {
  try {
    const [busCols] = await pool.query('SHOW COLUMNS FROM businesses');
    console.log('BUSINESSES COLS:', busCols.map(c => `${c.Field} (${c.Type})`));

    const [brCols] = await pool.query('SHOW COLUMNS FROM branches');
    console.log('BRANCHES COLS:', brCols.map(c => `${c.Field} (${c.Type})`));

    const [stCols] = await pool.query('SHOW COLUMNS FROM stores');
    console.log('STORES COLS:', stCols.map(c => `${c.Field} (${c.Type})`));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

inspect();
