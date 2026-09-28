// Migration 012: replace descriptive SKUs with compact 8-character codes.
// Previous SKUs are preserved so existing printed QR labels keep working.

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { buildBaseSku, ensureUniqueSku, orderedComboValues } = require('../utils/sku');

async function ensurePreviousSkuColumn(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'previous_sku'`
  );
  if (rows[0].count === 0) {
    await connection.query('ALTER TABLE products ADD COLUMN previous_sku VARCHAR(50) NULL AFTER sku');
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
      database: process.env.DB_NAME || 'hq_inventory_system'
    });

    await ensurePreviousSkuColumn(connection);

    const [products] = await connection.query('SELECT id, sku, previous_sku, name, business_id FROM products ORDER BY id ASC');
    const [branchLinks] = await connection.query(`
      SELECT pbs.product_id, br.branch_code
      FROM product_branch_stock pbs
      JOIN branches br ON br.id = pbs.branch_id
      ORDER BY pbs.product_id ASC, pbs.id ASC
    `);
    const [variantRows] = await connection.query(
      'SELECT product_id, attribute_key, value FROM product_variant_values ORDER BY id ASC'
    );

    const branchByProduct = {};
    branchLinks.forEach(({ product_id, branch_code }) => {
      if (!branchByProduct[product_id]) branchByProduct[product_id] = branch_code;
    });
    const variantsByProduct = {};
    variantRows.forEach(({ product_id, attribute_key, value }) => {
      if (!variantsByProduct[product_id]) variantsByProduct[product_id] = {};
      if (value) variantsByProduct[product_id][attribute_key] = value;
    });

    const reportPath = path.join(__dirname, 'sku-migration-report.json');
    const previousReport = fs.existsSync(reportPath)
      ? JSON.parse(fs.readFileSync(reportPath, 'utf8'))
      : [];
    const previousReportById = new Map(previousReport.map(row => [row.product_id, row]));
    const report = [];
    let updated = 0;
    for (const product of products) {
      const priorChange = previousReportById.get(product.id);
      if (/^[A-F0-9]{8}$/.test(product.sku)) {
        if (priorChange?.new_sku === product.sku) report.push(priorChange);
        continue;
      }

      const identityBranch = branchByProduct[product.id] || `BIZ${product.business_id || 0}`;
      const combo = variantsByProduct[product.id] || {};
      const baseSku = buildBaseSku(identityBranch, product.name, orderedComboValues(combo));
      const nextSku = await ensureUniqueSku(baseSku, connection, product.id);
      const oldSku = priorChange?.new_sku === product.sku ? priorChange.old_sku : product.sku;

      if (nextSku === product.sku) {
        if (priorChange?.new_sku === product.sku) {
          if (product.previous_sku !== oldSku) {
            await connection.query('UPDATE products SET previous_sku = ? WHERE id = ?', [oldSku, product.id]);
          }
          report.push(priorChange);
        }
        continue;
      }

      await connection.query(
        'UPDATE products SET previous_sku = ?, sku = ? WHERE id = ?',
        [oldSku, nextSku, product.id]
      );
      report.push({ product_id: product.id, name: product.name, variant: combo, old_sku: oldSku, new_sku: nextSku });
      updated++;
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[OK] Migration 012 complete. Updated ${updated} of ${products.length} products.`);
    console.log(`SKU changes written to: ${reportPath}`);
    console.log('Old SKUs are retained in products.previous_sku for existing QR labels.');
  } catch (error) {
    console.error('[ERROR] Migration 012 failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

run();
