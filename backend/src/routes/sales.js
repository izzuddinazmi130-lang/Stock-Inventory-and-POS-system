const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { resolveScope, handleScopeError } = require('../middleware/scope');
const { SALE_SELECT, normalizeSale, loadSale } = require('../utils/sales');

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ─── GET /api/sales ──────────────────────────────────────────────────────────
// Sales history. Branch admin: own branch only. Super admin: optional ?business_id / ?branch_id.
// Filters: from, to (YYYY-MM-DD, inclusive), payment_method, store_id, search (receipt no, product name or SKU).
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
    if (store_id) { where.push('s.store_id = ?'); params.push(parseInt(store_id, 10) || 0); }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where.push('(s.receipt_no LIKE ? OR s.note LIKE ? OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND (si.name LIKE ? OR si.sku LIKE ?)))');
      params.push(term, term, term, term);
    }
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

    const total = Number(summary.sales_count) || 0;
    return res.json({
      success: true,
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
