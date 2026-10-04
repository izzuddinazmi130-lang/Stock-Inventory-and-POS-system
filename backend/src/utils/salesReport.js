// Sales reports (pop-up store, shop floor) built from the receipts: `sales` + `sale_items`.
// Receipts keep their own copy of each line (name, SKU, price), so a report stays right even after a product is
// deleted (deleting a product removes its stock movements, which the old movement-based reports relied on).

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const SORTS = {
  date_desc: 's.created_at DESC, si.id DESC',
  date_asc: 's.created_at ASC, si.id ASC',
  amount_desc: 'si.line_total DESC, s.created_at DESC',
  amount_asc: 'si.line_total ASC, s.created_at DESC',
  qty_desc: 'si.quantity DESC, s.created_at DESC',
  qty_asc: 'si.quantity ASC, s.created_at DESC',
};

/**
 * @param db        pool or connection
 * @param where     SQL condition on `sales s` (e.g. 's.store_id = ?')
 * @param params    its parameters
 * @param filters   optional { payment_method, start_date, end_date, sort }
 * @returns { summary, lines, truncated }
 */
async function salesReport(db, where, params, filters = {}) {
  const conds = [where];
  const p = [...params];
  if (['cash', 'qr', 'online_banking'].includes(filters.payment_method)) { conds.push('s.payment_method = ?'); p.push(filters.payment_method); }
  if (isDate(filters.start_date)) { conds.push('s.created_at >= ?'); p.push(`${filters.start_date} 00:00:00`); }
  if (isDate(filters.end_date)) { conds.push('s.created_at <= ?'); p.push(`${filters.end_date} 23:59:59`); }
  const whereSql = conds.join(' AND ');

  const [[sum]] = await db.query(
    `SELECT COUNT(*) AS receipts,
            COALESCE(SUM(s.total_amount), 0) AS total_sales,
            COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount END), 0) AS total_cash,
            COALESCE(SUM(CASE WHEN s.payment_method = 'qr' THEN s.total_amount END), 0) AS total_qr,
            COALESCE(SUM(CASE WHEN s.payment_method = 'online_banking' THEN s.total_amount END), 0) AS total_online,
            COALESCE(SUM(s.total_quantity), 0) AS items
     FROM sales s WHERE ${whereSql}`,
    p
  );

  const LIMIT = 500;
  const [lines] = await db.query(
    `SELECT si.id, s.id AS sale_id, s.receipt_no, s.created_at, s.payment_method, s.price_tier,
            si.sku AS item_code, si.name AS item_name, si.variant_text, p.category,
            si.quantity, si.unit_price AS selling_price, si.line_total,
            u.full_name AS performed_by_name
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     LEFT JOIN users u ON u.id = s.cashier_id
     WHERE ${whereSql}
     ORDER BY ${SORTS[filters.sort] || SORTS.date_desc}
     LIMIT ${LIMIT + 1}`,
    p
  );

  const money = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;
  return {
    truncated: lines.length > LIMIT,
    lines: lines.slice(0, LIMIT).map(l => ({
      ...l,
      quantity: Number(l.quantity) || 0,
      selling_price: money(l.selling_price),
      line_total: money(l.line_total),
    })),
    summary: {
      total_sales: money(sum.total_sales),
      total_cash: money(sum.total_cash),
      total_qr: money(sum.total_qr),
      total_online: money(sum.total_online),
      total_items_sold: Number(sum.items) || 0,
      total_transactions: Number(sum.receipts) || 0,
    },
  };
}

module.exports = { salesReport };
