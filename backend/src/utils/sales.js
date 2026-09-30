/**
 * sales.js — helpers shared by the POS (qr.js) and the sales history (sales.js route).
 */

// Receipt dates follow the shop's local day, not the server's UTC day.
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kuala_Lumpur';

// 'YYYY-MM-DD' for today in the shop's timezone
function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Money is added up in sen (integers) so totals never pick up floating-point drift.
const toSen = (value) => Math.round((parseFloat(value) || 0) * 100);
const fromSen = (sen) => Math.round(sen) / 100;

/**
 * Issue the next receipt number for a branch, e.g. "MB-260930-0007".
 * Must be called inside the sale's transaction: the counter row stays locked until commit,
 * so two tills in the same branch can never get the same number.
 */
async function nextReceiptNo(conn, branchId, branchCode, day = localDate()) {
  await conn.query(
    `INSERT INTO receipt_counters (branch_id, sale_date, last_no) VALUES (?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_no = LAST_INSERT_ID(last_no + 1)`,
    [branchId, day]
  );
  const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() AS n');
  const code = String(branchCode || `BR${branchId}`).toUpperCase().replace(/[^A-Z0-9]/g, '') || `BR${branchId}`;
  return `${code}-${day.slice(2).replace(/-/g, '')}-${String(n).padStart(4, '0')}`;
}

// "Size L · Red" from a product's variant values (size first)
async function variantTextFor(conn, productId) {
  const [rows] = await conn.query('SELECT attribute_key, value FROM product_variant_values WHERE product_id = ?', [productId]);
  const parts = [];
  const size = rows.find(r => r.attribute_key === 'size' && r.value);
  if (size) parts.push(`Size ${size.value}`);
  rows.forEach(r => { if (r.attribute_key !== 'size' && r.value) parts.push(String(r.value)); });
  return parts.join(' · ') || null;
}

const SALE_SELECT = `
  SELECT s.id, s.receipt_no, s.business_id, s.branch_id, s.store_id, s.price_tier, s.payment_method,
         s.total_amount, s.cash_received, s.change_due, s.item_count, s.total_quantity, s.note,
         s.cashier_id, s.created_at,
         b.name AS business_name, br.name AS branch_name, br.branch_code,
         st.name AS store_name, u.full_name AS cashier_name
  FROM sales s
  JOIN businesses b ON b.id = s.business_id
  JOIN branches br ON br.id = s.branch_id
  LEFT JOIN stores st ON st.id = s.store_id
  LEFT JOIN users u ON u.id = s.cashier_id
`;

function normalizeSale(row) {
  return {
    ...row,
    total_amount: parseFloat(row.total_amount) || 0,
    cash_received: row.cash_received == null ? null : parseFloat(row.cash_received),
    change_due: row.change_due == null ? null : parseFloat(row.change_due),
  };
}

// One sale with its lines, in the shape the receipt screen uses
async function loadSale(db, saleId) {
  const [rows] = await db.query(`${SALE_SELECT} WHERE s.id = ?`, [saleId]);
  if (rows.length === 0) return null;
  const sale = normalizeSale(rows[0]);
  const [items] = await db.query(
    `SELECT id, product_id, sku, name, variant_text, quantity, unit_price, line_total
     FROM sale_items WHERE sale_id = ? ORDER BY id ASC`,
    [saleId]
  );
  sale.items = items.map(i => ({ ...i, unit_price: parseFloat(i.unit_price) || 0, line_total: parseFloat(i.line_total) || 0 }));
  return sale;
}

module.exports = { APP_TIMEZONE, localDate, toSen, fromSen, nextReceiptNo, variantTextFor, SALE_SELECT, normalizeSale, loadSale };
