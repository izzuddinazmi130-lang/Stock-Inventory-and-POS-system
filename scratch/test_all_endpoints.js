const pool = require('../backend/src/config/db');

async function test() {
  try {
    console.log('=== TEST GET BRANCH 1 ===');
    const [b1] = await pool.query('SELECT b.*, biz.name AS business_name FROM branches b LEFT JOIN businesses biz ON b.business_id = biz.id WHERE b.id = 1');
    const [stats1] = await pool.query(`
      SELECT 
        COUNT(*) as totalItems,
        COALESCE(SUM(quantity), 0) as totalStock,
        SUM(CASE WHEN quantity <= minimum_quantity THEN 1 ELSE 0 END) as lowStockCount
      FROM stock_items 
      WHERE branch_id = 1 AND is_active = 1
    `);
    const [p1] = await pool.query('SELECT s.*, s.minimum_quantity AS min_quantity, b.name AS branch_name FROM stock_items s JOIN branches b ON s.branch_id = b.id WHERE s.branch_id = 1 AND s.is_active = 1');
    console.log('Branch 1 Profile:', b1[0].name, 'Business:', b1[0].business_name);
    console.log('Branch 1 Stats:', stats1[0]);
    console.log('Branch 1 Products Count:', p1.length);
    p1.forEach(item => console.log(` - [${item.item_code}] ${item.item_name}: ${item.quantity} units (min: ${item.min_quantity})`));

    console.log('\n=== TEST GET BRANCH 2 ===');
    const [b2] = await pool.query('SELECT b.*, biz.name AS business_name FROM branches b LEFT JOIN businesses biz ON b.business_id = biz.id WHERE b.id = 2');
    const [stats2] = await pool.query(`
      SELECT 
        COUNT(*) as totalItems,
        COALESCE(SUM(quantity), 0) as totalStock,
        SUM(CASE WHEN quantity <= minimum_quantity THEN 1 ELSE 0 END) as lowStockCount
      FROM stock_items 
      WHERE branch_id = 2 AND is_active = 1
    `);
    const [p2] = await pool.query('SELECT s.*, s.minimum_quantity AS min_quantity, b.name AS branch_name FROM stock_items s JOIN branches b ON s.branch_id = b.id WHERE s.branch_id = 2 AND s.is_active = 1');
    console.log('Branch 2 Profile:', b2[0].name, 'Business:', b2[0].business_name);
    console.log('Branch 2 Stats:', stats2[0]);
    console.log('Branch 2 Products Count:', p2.length);
    p2.forEach(item => console.log(` - [${item.item_code}] ${item.item_name}: ${item.quantity} units (min: ${item.min_quantity})`));

    console.log('\nALL QUERIES PASSED WITH 0 ERRORS!');

  } catch (err) {
    console.error('TEST ERROR:', err);
  } finally {
    process.exit();
  }
}

test();
