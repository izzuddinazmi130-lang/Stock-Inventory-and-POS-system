const pool = require('../backend/src/config/db');

async function test() {
  try {
    console.log('--- TEST BRANCH 1 QUERY ---');
    const [b1] = await pool.query(`
      SELECT b.*, biz.name AS business_name 
      FROM branches b 
      LEFT JOIN businesses biz ON b.business_id = biz.id 
      WHERE b.id = 1
    `);
    console.log('Branch 1 result:', b1);

    console.log('--- TEST STATS QUERY ---');
    const [prodStats] = await pool.query(`
      SELECT 
        COUNT(*) as totalItems,
        COALESCE(SUM(quantity), 0) as totalStock,
        SUM(CASE WHEN quantity <= minimum_quantity THEN 1 ELSE 0 END) as lowStockCount
      FROM stock_items 
      WHERE branch_id = 1 AND is_active = 1
    `);
    console.log('Stats result:', prodStats);

    console.log('--- TEST PRODUCTS FOR BRANCH 1 ---');
    const [prods] = await pool.query(`
      SELECT s.*, s.minimum_quantity AS min_quantity, b.name AS branch_name 
      FROM stock_items s 
      JOIN branches b ON s.branch_id = b.id 
      WHERE s.branch_id = 1 AND s.is_active = 1
    `);
    console.log('Products count for branch 1:', prods.length);
    console.log(prods);

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit();
  }
}

test();
