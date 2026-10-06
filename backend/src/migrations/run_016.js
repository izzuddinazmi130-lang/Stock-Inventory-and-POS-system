// Migration 016: tidy the schema and the activity log.
//
//  - Removes leftover "warehouse" columns from the old system (no code uses them):
//      audit_logs.warehouse_id, stock_movements.warehouse_id, users.assigned_warehouse_id
//  - Activity log uses one name per event and one set of roles:
//      login → LOGIN, user_approval → APPROVE_USER, user_rejection → REJECT_USER,
//      registration_request → REGISTER_PENDING; old roles admin_kaftanasia / admin_astech → admin
//  - products.status is only 'available' or 'discontinued' (low / out of stock comes from branch quantities)
//  - Indexes for stock history by branch and by pop-up store (Stock reports, store and branch pages)
//  - Removes activity-log rows written by automated QA runs (user agent "node", headless Chrome or the
//    reset-password script, from 1 Oct 2026). Real activity from browsers and phones is untouched.
//  - ID counters restart after the highest id still in use
//
// Safe to run more than once.  Usage (from backend/):  node src/migrations/run_016.js

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'hq_inventory_system',
  });
  const hasColumn = async (table, column) => {
    const [r] = await conn.query(
      'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, column]
    );
    return r[0].c > 0;
  };
  const hasIndex = async (table, index) => {
    const [r] = await conn.query(
      'SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
      [table, index]
    );
    return r[0].c > 0;
  };

  try {
    // 1. Activity-log rows from automated QA runs
    const [qa] = await conn.query(
      `DELETE FROM audit_logs
       WHERE created_at >= '2026-10-01'
         AND (user_agent IN ('node', 'reset-password script') OR user_agent LIKE '%HeadlessChrome%')`
    );
    console.log(`Removed ${qa.affectedRows} activity-log rows written by QA test runs`);

    // 2. One name per event, one set of roles
    const renames = [['login', 'LOGIN'], ['user_approval', 'APPROVE_USER'], ['user_rejection', 'REJECT_USER'], ['registration_request', 'REGISTER_PENDING']];
    for (const [from, to] of renames) {
      const [r] = await conn.query('UPDATE audit_logs SET action = ? WHERE BINARY action = ?', [to, from]);
      if (r.affectedRows) console.log(`Activity log: ${from} → ${to} (${r.affectedRows})`);
    }
    const [roles] = await conn.query("UPDATE audit_logs SET user_role = 'admin' WHERE user_role IN ('admin_kaftanasia', 'admin_astech')");
    const [blank] = await conn.query("UPDATE audit_logs SET user_role = NULL WHERE user_role = ''");
    if (roles.affectedRows || blank.affectedRows) console.log(`Activity log roles tidied (${roles.affectedRows + blank.affectedRows})`);
    await conn.query("ALTER TABLE audit_logs MODIFY user_role ENUM('super_admin','admin') DEFAULT NULL");

    // 3. Old warehouse columns
    for (const [table, column] of [['audit_logs', 'warehouse_id'], ['stock_movements', 'warehouse_id'], ['users', 'assigned_warehouse_id']]) {
      if (await hasColumn(table, column)) {
        await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        console.log(`Dropped ${table}.${column}`);
      }
    }

    // 4. Product status: only "for sale" or "hidden"
    const [st] = await conn.query("UPDATE products SET status = 'available' WHERE status = 'out_of_stock'");
    if (st.affectedRows) console.log(`Products: ${st.affectedRows} 'out_of_stock' → 'available'`);
    await conn.query("ALTER TABLE products MODIFY status ENUM('available','discontinued') NOT NULL DEFAULT 'available'");

    // 5. Every stock movement belongs to a branch; index the common lookups
    const [nulls] = await conn.query('SELECT COUNT(*) AS c FROM stock_movements WHERE branch_id IS NULL');
    if (!nulls[0].c) await conn.query('ALTER TABLE stock_movements MODIFY branch_id INT(10) UNSIGNED NOT NULL');
    if (!(await hasIndex('stock_movements', 'idx_mv_branch_created'))) {
      await conn.query('ALTER TABLE stock_movements ADD INDEX idx_mv_branch_created (branch_id, created_at)');
      console.log('Added index stock_movements(branch_id, created_at)');
    }
    if (!(await hasIndex('stock_movements', 'idx_mv_store'))) {
      await conn.query('ALTER TABLE stock_movements ADD INDEX idx_mv_store (store_id)');
      console.log('Added index stock_movements(store_id)');
    }
    if (!(await hasIndex('sales', 'idx_sales_store'))) {
      await conn.query('ALTER TABLE sales ADD INDEX idx_sales_store (store_id)');
      console.log('Added index sales(store_id)');
    }

    // 6. ID counters continue after the highest id still in use OR still referenced (receipts, stock history and the
    //    activity log keep ids of deleted rows, so a reused id would link old records to a new, unrelated row)
    const maxOf = async (sql) => Number((await conn.query(sql))[0][0].m) || 0;
    const audited = (type) => `SELECT MAX(entity_id) AS m FROM audit_logs WHERE entity_type = '${type}'`;
    const refs = {
      products: ['SELECT MAX(product_id) AS m FROM sale_items', 'SELECT MAX(item_id) AS m FROM stock_movements', 'SELECT MAX(product_id) AS m FROM damage_reports', audited('products')],
      branches: ['SELECT MAX(branch_id) AS m FROM sales', 'SELECT MAX(branch_id) AS m FROM stock_movements', audited('branches')],
      businesses: ['SELECT MAX(business_id) AS m FROM sales', audited('businesses')],
      stores: ['SELECT MAX(store_id) AS m FROM sales', 'SELECT MAX(store_id) AS m FROM stock_movements', audited('stores')],
      users: ['SELECT MAX(cashier_id) AS m FROM sales', 'SELECT MAX(performed_by) AS m FROM stock_movements', 'SELECT MAX(user_id) AS m FROM audit_logs', audited('users')],
      damage_reports: [audited('damage_reports')],
      stock_movements: ['SELECT MAX(movement_id) AS m FROM sale_items'],
      sales: [],
      sale_items: [],
      audit_logs: [],
      business_form_categories: [audited('business_form_categories')],
      business_form_fields: [audited('business_form_fields')],
      damage_report_photos: [],
      product_branch_stock: [audited('product_branch_stock')],
      product_variant_values: [],
    };
    for (const [table, sqls] of Object.entries(refs)) {
      let next = (await maxOf(`SELECT MAX(id) AS m FROM \`${table}\``)) + 1;
      for (const sql of sqls) next = Math.max(next, (await maxOf(sql)) + 1);
      await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${next}`);
    }
    console.log('ID counters continue after the highest id in use or referenced');

    console.log('Migration 016 complete.');
  } catch (err) {
    console.error('Migration 016 failed:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
