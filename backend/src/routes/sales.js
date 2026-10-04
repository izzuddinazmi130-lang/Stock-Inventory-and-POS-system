const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { resolveScope, handleScopeError } = require('../middleware/scope');
const { SALE_SELECT, normalizeSale, loadSale } = require('../utils/sales');

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ─── GET /api/sales ──────────────────────────────────────────────────────────
// Sales history. Branch admin: own branch only. Super admin: optional ?business_id / ?branch_id.
// Filters: from, to (YYYY-MM-DD, inclusive), payment_method, search (receipt no, product name or SKU) and
// store_id: a pop-up store's id, or "floor" for sales rung up at the branch counter (no store).
// by_location breaks the takings down per branch + location (shop floor / each store), ignoring store_id.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
    const { from, to, payment_method, store_id, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const where = ['1=1'];
    const params = [];
    if (businessId) { where.push('s.business_id = ?'); params.push(businessId); }
    if (branchId) { where.push('s.branch_id = ?'); params.push(branchId); }
    if (isDate(from)) { where.push('s.created_at >= ?'); params.push(`${from} 00:00:00`); }
    if (isDate(to)) { where.push('s.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(`${to} 00:00:00`); }
    if (['cash', 'qr', 'online_banking'].includes(payment_method)) { where.push('s.payment_method = ?'); params.push(payment_method); }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where.push('(s.receipt_no LIKE ? OR s.note LIKE ? OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND (si.name LIKE ? OR si.sku LIKE ?)))');
      params.push(term, term, term, term);
    }
    // Everything except the location filter: used for the per-location breakdown
    const allLocationsSql = where.join(' AND ');
    const allLocationsParams = [...params];
    if (store_id === 'floor') where.push('s.store_id IS NULL');
    else if (store_id) { where.push('s.store_id = ?'); params.push(parseInt(store_id, 10) || 0); }
    const whereSql = where.join(' AND ');

    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS sales_count,
              COALESCE(SUM(s.total_amount), 0) AS revenue,
              COALESCE(SUM(s.total_quantity), 0) AS units,
              COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount END), 0) AS cash,
              COALESCE(SUM(CASE WHEN s.payment_method = 'qr' THEN s.total_amount END), 0) AS qr,
              COALESCE(SUM(CASE WHEN s.payment_method = 'online_banking' THEN s.total_amount END), 0) AS online_banking
       FROM sales s WHERE ${whereSql}`,
      params
    );

    const [rows] = await pool.query(
      `${SALE_SELECT} WHERE ${whereSql} ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );

    // A short "what was sold" line for each row
    const ids = rows.map(r => r.id);
    const preview = {};
    if (ids.length > 0) {
      const [lines] = await pool.query(
        'SELECT sale_id, name, variant_text, quantity FROM sale_items WHERE sale_id IN (?) ORDER BY id ASC',
        [ids]
      );
      lines.forEach(l => {
        (preview[l.sale_id] = preview[l.sale_id] || []).push(`${l.quantity} × ${l.name}${l.variant_text ? ` (${l.variant_text})` : ''}`);
      });
    }

    const [locations] = await pool.query(
      `SELECT s.branch_id, br.name AS branch_name, br.branch_code, br.business_id, b.name AS business_name,
              s.store_id, st.name AS store_name,
              st.venue AS store_venue, st.status AS store_status,
              COUNT(*) AS sales_count, COALESCE(SUM(s.total_amount), 0) AS revenue,
              COALESCE(SUM(s.total_quantity), 0) AS units, MAX(s.created_at) AS last_sale_at
       FROM sales s
       JOIN branches br ON br.id = s.branch_id
       JOIN businesses b ON b.id = br.business_id
       LEFT JOIN stores st ON st.id = s.store_id
       WHERE ${allLocationsSql}
       GROUP BY s.branch_id, s.store_id
       ORDER BY revenue DESC`,
      allLocationsParams
    );

    const total = Number(summary.sales_count) || 0;
    return res.json({
      success: true,
      by_location: locations.map(l => ({
        ...l,
        sales_count: Number(l.sales_count) || 0,
        revenue: parseFloat(l.revenue) || 0,
        units: Number(l.units) || 0,
      })),
      sales: rows.map(r => ({ ...normalizeSale(r), items_preview: preview[r.id] || [] })),
      summary: {
        sales_count: total,
        revenue: parseFloat(summary.revenue) || 0,
        units: Number(summary.units) || 0,
        average: total ? (parseFloat(summary.revenue) || 0) / total : 0,
        by_payment: {
          cash: parseFloat(summary.cash) || 0,
          qr: parseFloat(summary.qr) || 0,
          online_banking: parseFloat(summary.online_banking) || 0
        }
      },
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    console.error('Sales history error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load sales: ' + err.message });
  }
});

// ─── GET /api/sales/overview ────────────────────────────────────────────────
// Counter activity for one day (default today): takings, payment mix, sales by hour, every branch's counter,
// best sellers and the latest receipts. Super admin: all branches (optional ?business_id).
// Branch admin: own branch. ?date=YYYY-MM-DD picks the day.
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
    const day = isDate(req.query.date) ? req.query.date : null;
    const dayExpr = day ? '?' : 'CURDATE()';
    const dayParams = day ? [day] : [];

    // Sales on the chosen day within scope
    const where = [`s.created_at >= ${dayExpr}`, `s.created_at < DATE_ADD(${dayExpr}, INTERVAL 1 DAY)`];
    const params = [...dayParams, ...dayParams];
    if (businessId) { where.push('s.business_id = ?'); params.push(businessId); }
    if (branchId) { where.push('s.branch_id = ?'); params.push(branchId); }
    const whereSql = where.join(' AND ');

    // Same scope, the day before (for the comparison)
    const prevWhere = [`s.created_at >= DATE_SUB(${dayExpr}, INTERVAL 1 DAY)`, `s.created_at < ${dayExpr}`];
    const prevParams = [...dayParams, ...dayParams];
    if (businessId) { prevWhere.push('s.business_id = ?'); prevParams.push(businessId); }
    if (branchId) { prevWhere.push('s.branch_id = ?'); prevParams.push(branchId); }

    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS sales_count, COALESCE(SUM(s.total_amount), 0) AS revenue, COALESCE(SUM(s.total_quantity), 0) AS units,
              COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount END), 0) AS cash,
              COALESCE(SUM(CASE WHEN s.payment_method = 'qr' THEN s.total_amount END), 0) AS qr,
              COALESCE(SUM(CASE WHEN s.payment_method = 'online_banking' THEN s.total_amount END), 0) AS online_banking,
              SUM(s.payment_method = 'cash') AS cash_count, SUM(s.payment_method = 'qr') AS qr_count,
              SUM(s.payment_method = 'online_banking') AS online_banking_count
       FROM sales s WHERE ${whereSql}`, params);

    const [[previous]] = await pool.query(
      `SELECT COUNT(*) AS sales_count, COALESCE(SUM(s.total_amount), 0) AS revenue FROM sales s WHERE ${prevWhere.join(' AND ')}`,
      prevParams);

    const [hourly] = await pool.query(
      `SELECT HOUR(s.created_at) AS hour, COUNT(*) AS sales_count, COALESCE(SUM(s.total_amount), 0) AS revenue
       FROM sales s WHERE ${whereSql} GROUP BY HOUR(s.created_at)`, params);

    // Every active branch in scope, including ones with no sales yet
    const branchWhere = ['br.is_active = 1'];
    const branchParams = [];
    if (businessId) { branchWhere.push('br.business_id = ?'); branchParams.push(businessId); }
    if (branchId) { branchWhere.push('br.id = ?'); branchParams.push(branchId); }
    const [branches] = await pool.query(
      `SELECT br.id AS branch_id, br.name AS branch_name, br.branch_code, br.business_id, b.name AS business_name,
              COUNT(s.id) AS sales_count, COALESCE(SUM(s.total_amount), 0) AS revenue,
              COALESCE(SUM(s.total_quantity), 0) AS units, MAX(s.created_at) AS last_sale_at,
              COUNT(DISTINCT s.cashier_id) AS cashiers
       FROM branches br
       JOIN businesses b ON b.id = br.business_id
       LEFT JOIN sales s ON s.branch_id = br.id
            AND s.created_at >= ${dayExpr} AND s.created_at < DATE_ADD(${dayExpr}, INTERVAL 1 DAY)
       WHERE ${branchWhere.join(' AND ')}
       GROUP BY br.id
       ORDER BY revenue DESC, b.name, br.name`,
      [...dayParams, ...dayParams, ...branchParams]);

    const [topProducts] = await pool.query(
      `SELECT si.sku, si.name, MAX(si.variant_text) AS variant_text,
              SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE ${whereSql}
       GROUP BY si.sku, si.name
       ORDER BY quantity DESC, revenue DESC
       LIMIT 5`, params);

    const [recentRows] = await pool.query(
      `${SALE_SELECT} WHERE ${whereSql} ORDER BY s.created_at DESC, s.id DESC LIMIT 8`, params);

    const [[{ day: resolvedDay }]] = await pool.query(`SELECT DATE_FORMAT(${dayExpr}, '%Y-%m-%d') AS day`, dayParams);

    const count = Number(totals.sales_count) || 0;
    const revenue = parseFloat(totals.revenue) || 0;
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales_count: 0, revenue: 0 }));
    hourly.forEach(r => { byHour[r.hour] = { hour: r.hour, sales_count: Number(r.sales_count), revenue: parseFloat(r.revenue) || 0 }; });

    return res.json({
      success: true,
      date: resolvedDay,
      totals: {
        sales_count: count,
        revenue,
        units: Number(totals.units) || 0,
        average: count ? revenue / count : 0,
        by_payment: {
          cash: { amount: parseFloat(totals.cash) || 0, count: Number(totals.cash_count) || 0 },
          qr: { amount: parseFloat(totals.qr) || 0, count: Number(totals.qr_count) || 0 },
          online_banking: { amount: parseFloat(totals.online_banking) || 0, count: Number(totals.online_banking_count) || 0 },
        },
      },
      previous: { sales_count: Number(previous.sales_count) || 0, revenue: parseFloat(previous.revenue) || 0 },
      by_hour: byHour,
      branches: branches.map(b => ({
        ...b,
        sales_count: Number(b.sales_count) || 0,
        revenue: parseFloat(b.revenue) || 0,
        units: Number(b.units) || 0,
        cashiers: Number(b.cashiers) || 0,
      })),
      top_products: topProducts.map(t => ({ ...t, quantity: Number(t.quantity) || 0, revenue: parseFloat(t.revenue) || 0 })),
      recent: recentRows.map(normalizeSale),
    });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    console.error('Sales overview error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load the sales overview: ' + err.message });
  }
});

// ─── GET /api/sales/:id ──────────────────────────────────────────────────────
// One sale with its lines (for viewing / reprinting the receipt)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
    const sale = await loadSale(pool, parseInt(req.params.id, 10) || 0);
    if (!sale
      || (businessId && sale.business_id !== businessId)
      || (branchId && sale.branch_id !== branchId)) {
      return res.status(404).json({ success: false, message: 'Sale not found.' });
    }
    return res.json({ success: true, sale });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
