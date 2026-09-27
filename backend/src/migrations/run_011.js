// Migration 011: regenerate every product's SKU into the new variant-specific
// format: {BRANCHCODE}-{PRODUCT-NAME}-{VARIANT-VALUES...}
//
// IMPORTANT: every SKU that changes gets a new QR code too, because the QR
// token embeds the SKU (see routes/qr.js). Any QR sticker already printed
// for a product touched by this migration will stop scanning correctly and
// needs to be reprinted. This script writes a full old->new report to
// sku-migration-report.json specifically so you know which labels to redo.
//
// Safe to re-run: if a product's SKU already matches the new format for its
// current name/branch/variants, it is left untouched.

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { buildBaseSku, ensureUniqueSku, orderedComboValues } = require('../utils/sku');

async function ensurePreviousSkuColumn(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'previous_sku'`
  );
  if (rows[0].cnt === 0) {
    await connection.query('ALTER TABLE products ADD COLUMN previous_sku VARCHAR(50) NULL AFTER sku');
    console.log('[OK] Added products.previous_sku column.');
  }
}

async function run() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'hq_inventory_system',
      multipleStatements: true
    });

    await ensurePreviousSkuColumn(connection);

    const [products] = await connection.query('SELECT id, sku, name FROM products ORDER BY id ASC');

    // Branch code used per product = its earliest-stocked branch (mirrors how
    // the SKU is built at creation time: the first branch selected).
    const [branchLinks] = await connection.query(`
      SELECT pbs.product_id, br.branch_code
      FROM product_branch_stock pbs
      JOIN branches br ON br.id = pbs.branch_id
      ORDER BY pbs.product_id ASC, pbs.id ASC
    `);
    const branchCodeByProduct = {};
    branchLinks.forEach(row => {
      if (!branchCodeByProduct[row.product_id]) {
        branchCodeByProduct[row.product_id] = row.branch_code;
      }
    });

    const [variantRows] = await connection.query('SELECT product_id, attribute_key, value FROM product_variant_values');
    const variantsByProduct = {};
    variantRows.forEach(v => {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = {};
      if (v.value) variantsByProduct[v.product_id][v.attribute_key] = v.value;
    });

    const report = [];
    let updated = 0;
    let skippedNoBranch = 0;
    let unchanged = 0;

    for (const product of products) {
      const branchCode = branchCodeByProduct[product.id];
      if (!branchCode) {
        // Product isn't stocked anywhere (orphaned) — nothing to build a
        // meaningful branch-scoped SKU from. Leave it alone.
        skippedNoBranch++;
        continue;
      }
      const combo = variantsByProduct[product.id] || {};
      const baseSku = buildBaseSku(branchCode, product.name, orderedComboValues(combo));

      if (baseSku === product.sku) {
        unchanged++;
        continue;
      }

      const newSku = await ensureUniqueSku(baseSku, connection, product.id);
      await connection.query(
        'UPDATE products SET previous_sku = ?, sku = ? WHERE id = ?',
        [product.sku, newSku, product.id]
      );
      report.push({ product_id: product.id, name: product.name, variant: combo, old_sku: product.sku, new_sku: newSku });
      updated++;
    }

    const reportPath = path.join(__dirname, 'sku-migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`[OK] Migration 011 complete.`);
    console.log(`     Updated: ${updated}`);
    console.log(`     Already in new format: ${unchanged}`);
    console.log(`     Skipped (not stocked in any branch): ${skippedNoBranch}`);
    console.log(`     Full old->new report written to: ${reportPath}`);
    if (updated > 0) {
      console.log(`     ⚠ Reprint QR labels for the ${updated} product(s) listed in that report — their QR tokens changed.`);
    }
  } catch (error) {
    console.error('[ERROR] Migration 011 failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

run();