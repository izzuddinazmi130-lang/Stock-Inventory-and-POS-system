const pool = require('../backend/src/config/db');

async function main() {
  console.log('Running product schema migration...');

  // Add 3-tier pricing columns
  try {
    await pool.query('ALTER TABLE stock_items ADD COLUMN price_dealer DECIMAL(12,2) DEFAULT 0.00 AFTER selling_price');
    console.log('+ price_dealer column added');
  } catch(e) { console.log('price_dealer already exists:', e.code); }

  try {
    await pool.query('ALTER TABLE stock_items ADD COLUMN price_staff DECIMAL(12,2) DEFAULT 0.00 AFTER price_dealer');
    console.log('+ price_staff column added');
  } catch(e) { console.log('price_staff already exists:', e.code); }

  // Add generic model column
  try {
    await pool.query('ALTER TABLE stock_items ADD COLUMN model VARCHAR(150) DEFAULT NULL AFTER size');
    console.log('+ model column added');
  } catch(e) { console.log('model already exists:', e.code); }

  // Add unique QR code column
  try {
    await pool.query('ALTER TABLE stock_items ADD COLUMN qr_code VARCHAR(120) DEFAULT NULL AFTER item_code');
    console.log('+ qr_code column added');
  } catch(e) { console.log('qr_code already exists:', e.code); }

  // Add unique index on qr_code
  try {
    await pool.query('ALTER TABLE stock_items ADD UNIQUE KEY unique_product_qr (qr_code)');
    console.log('+ unique index on qr_code added');
  } catch(e) { console.log('unique index may already exist:', e.code); }

  // Set branch codes
  await pool.query("UPDATE branches SET branch_code = 'KA' WHERE id = 1 AND (branch_code IS NULL OR branch_code = '')");
  await pool.query("UPDATE branches SET branch_code = 'AS' WHERE id = 2 AND (branch_code IS NULL OR branch_code = '')");
  console.log('+ branch_codes updated');

  // Set business industries
  await pool.query("UPDATE businesses SET industry = 'fashion' WHERE id = 1");
  await pool.query("UPDATE businesses SET industry = 'technology' WHERE id = 2");
  console.log('+ business industries updated');

  // Verify
  const [cols] = await pool.query('SHOW COLUMNS FROM stock_items');
  console.log('\nFinal stock_items columns:', cols.map(c => c.Field).join(', '));

  const [br] = await pool.query('SELECT id, name, branch_code FROM branches');
  console.log('Branches:', JSON.stringify(br));

  const [biz] = await pool.query('SELECT id, name, industry FROM businesses');
  console.log('Businesses:', JSON.stringify(biz));

  process.exit(0);
}

main().catch(e => {
  console.error('Migration error:', e.message);
  process.exit(1);
});
