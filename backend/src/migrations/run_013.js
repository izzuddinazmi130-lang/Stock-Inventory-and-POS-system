// Migration 013: sales + receipt numbers, cash received / change due, and stock status clean-up.
//
//  - sales            one row per POS sale (receipt number, totals, payment, cash received, change)
//  - sale_items       the lines of each sale (snapshot of name/SKU/price at the time of sale)
//  - receipt_counters per-branch daily counter used to issue receipt numbers like KA-260930-0001
//  - stock_movements.sale_id links each POS stock-out movement to its sale
//  - products.status  'out_of_stock' was auto-set whenever ANY branch hit 0, so it disagreed with the
//                     other branches' quantities. Stock level is now derived per branch from quantity,
//                     so existing 'out_of_stock' rows are reset to 'available'.
//  - Backfill         earlier POS sales (stock_movements notes starting "[POS Sale") are grouped into
//                     sales with receipt numbers so they appear in Sales history. Cash received / change
//                     were never recorded for those, so they stay empty.
//
// Safe to run more than once.  Usage (from backend/):  node src/migrations/run_013.js

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { nextReceiptNo, variantTextFor } = require('../utils/sales');

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci';
const DEFAULT_NOTES = ['Counter POS Sale', 'POS Counter Sale'];

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function createSchema(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      receipt_no VARCHAR(40) NOT NULL,
      business_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NOT NULL,
      store_id INT UNSIGNED NULL,
      price_tier ENUM('customer','dealer','staff') NOT NULL DEFAULT 'customer',
      payment_method ENUM('cash','qr','online_banking') NOT NULL DEFAULT 'cash',
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      cash_received DECIMAL(12,2) NULL,
      change_due DECIMAL(12,2) NULL,
      item_count INT NOT NULL DEFAULT 0,
      total_quantity INT NOT NULL DEFAULT 0,
      note VARCHAR(255) NULL,
      cashier_id INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_receipt_no (receipt_no),
      KEY idx_sales_branch_date (branch_id, created_at),
      KEY idx_sales_business_date (business_id, created_at),
      CONSTRAINT fk_sales_business FOREIGN KEY (business_id) REFERENCES businesses(id),
      CONSTRAINT fk_sales_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
      CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
    ) ${TABLE_OPTIONS}
  `);
  console.log('[OK] sales');

  // No FK to products: a sale keeps its receipt lines even if the product is later deleted
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      sale_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NULL,
      movement_id INT UNSIGNED NULL,
      sku VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      variant_text VARCHAR(255) NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      line_total DECIMAL(12,2) NOT NULL,
      cost_price DECIMAL(12,2) NULL,
      KEY idx_sale_items_sale (sale_id),
      KEY idx_sale_items_product (product_id),
      CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);
  console.log('[OK] sale_items');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS receipt_counters (
      branch_id INT UNSIGNED NOT NULL,
      sale_date DATE NOT NULL,
      last_no INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (branch_id, sale_date),
      CONSTRAINT fk_receipt_counters_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);
  console.log('[OK] receipt_counters');

  if (!(await columnExists(conn, 'stock_movements', 'sale_id'))) {
    await conn.query('ALTER TABLE stock_movements ADD COLUMN sale_id INT UNSIGNED NULL, ADD KEY idx_movements_sale (sale_id)');
    console.log('[OK] stock_movements.sale_id added');
  } else {
    console.log('[INFO] stock_movements.sale_id already exists');
  }

  // audit_logs.user_role still had the old role names, so every branch admin's action was saved with an empty role
  await conn.query(
    "ALTER TABLE audit_logs MODIFY user_role ENUM('super_admin','admin','admin_kaftanasia','admin_astech') DEFAULT NULL"
  );
  const [roleFix] = await conn.query(
    "UPDATE audit_logs a JOIN users u ON u.id = a.user_id SET a.user_role = u.role WHERE a.user_role = '' OR a.user_role IS NULL"
  );
  console.log(`[OK] audit_logs.user_role accepts 'admin' (${roleFix.affectedRows} old row(s) filled in)`);

  const [upd] = await conn.query("UPDATE products SET status = 'available' WHERE status = 'out_of_stock'");
  console.log(`[OK] ${upd.affectedRows} product(s) reset from 'out_of_stock' to 'available'`);
}

// One POS checkout wrote all its lines with the same cashier, time, payment, store and note
async function backfillSales(conn) {
  const [rows] = await conn.query(`
    SELECT sm.id, sm.branch_id, sm.store_id, sm.item_id, sm.quantity, sm.unit_price, sm.selling_price,
           sm.payment_method, sm.note, sm.performed_by, sm.created_at,
           br.business_id, br.branch_code, p.sku, p.name
    FROM stock_movements sm
    JOIN branches br ON br.id = sm.branch_id
    LEFT JOIN products p ON p.id = sm.item_id
    WHERE sm.movement_type = 'out' AND sm.note LIKE '[POS Sale%' AND sm.sale_id IS NULL
    ORDER BY sm.created_at ASC, sm.id ASC
  `);

  const groups = new Map();
  rows.forEach(r => {
    const key = [r.branch_id, r.performed_by, r.created_at, r.payment_method, r.store_id, r.note].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  let created = 0;
  for (const lines of groups.values()) {
    const first = lines[0];
    const tierMatch = /^\[POS Sale - (\w+)\]/.exec(first.note || '');
    const tier = ['customer', 'dealer', 'staff'].includes(tierMatch?.[1]?.toLowerCase()) ? tierMatch[1].toLowerCase() : 'customer';
    const noteText = String(first.note || '').replace(/^\[[^\]]*\]\s*/, '').trim();
    const note = noteText && !DEFAULT_NOTES.includes(noteText) ? noteText.slice(0, 255) : null;

    let totalSen = 0;
    let totalQty = 0;
    const items = lines.map(l => {
      const qty = parseInt(l.quantity, 10) || 0;
      const unitSen = Math.round((parseFloat(l.selling_price) || 0) * 100);
      totalSen += unitSen * qty;
      totalQty += qty;
      return { ...l, qty, unit: unitSen / 100, lineTotal: (unitSen * qty) / 100 };
    });

    await conn.beginTransaction();
    try {
      const day = String(first.created_at).slice(0, 10);
      const receiptNo = await nextReceiptNo(conn, first.branch_id, first.branch_code, day);
      const [saleRes] = await conn.query(
        `INSERT INTO sales (receipt_no, business_id, branch_id, store_id, price_tier, payment_method, total_amount,
                            cash_received, change_due, item_count, total_quantity, note, cashier_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
        [receiptNo, first.business_id, first.branch_id, first.store_id, tier, first.payment_method || 'cash',
          totalSen / 100, items.length, totalQty, note, first.performed_by, first.created_at]
      );
      const saleId = saleRes.insertId;
      for (const it of items) {
        await conn.query(
          `INSERT INTO sale_items (sale_id, product_id, movement_id, sku, name, variant_text, quantity, unit_price, line_total, cost_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [saleId, it.item_id, it.id, it.sku || '—', it.name || 'Deleted product',
            it.sku ? await variantTextFor(conn, it.item_id) : null,
            it.qty, it.unit, it.lineTotal, it.unit_price]
        );
      }
      await conn.query('UPDATE stock_movements SET sale_id = ? WHERE id IN (?)', [saleId, items.map(i => i.id)]);
      await conn.commit();
      created++;
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }
  console.log(`[OK] ${created} earlier POS sale(s) added to Sales history (from ${rows.length} stock movement line(s))`);
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'hq_inventory_system',
    dateStrings: true
  });

  try {
    console.log('Running migration 013...');
    await createSchema(conn);
    await backfillSales(conn);
    console.log('[OK] Migration 013 complete.');
  } finally {
    await conn.end();
  }
}

run().catch(err => {
  console.error('[ERROR] Migration 013 failed:', err.message);
  process.exit(1);
});
