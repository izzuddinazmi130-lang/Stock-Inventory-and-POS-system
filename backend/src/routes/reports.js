const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { resolveScope, handleScopeError, ScopeError } = require('../middleware/scope');

// Scope for report queries. Admin: own business + branch (query business_id/branch_id ignored),
// and store_id only if that store is in their branch. Super admin: any business / branch / store / all.
async function resolveReportScope(req) {
  const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
  const storeId = req.query.store_id && req.query.store_id !== 'all' ? parseInt(req.query.store_id, 10) : null;
  if (req.query.store_id && req.query.store_id !== 'all' && !storeId) throw new ScopeError(400, 'Invalid store_id');

  if (storeId && req.user.role !== 'super_admin') {
    const [rows] = await pool.query('SELECT id FROM stores WHERE id = ? AND branch_id = ?', [storeId, branchId]);
    if (rows.length === 0) throw new ScopeError(403, 'Access denied: that store does not belong to your branch.');
  }
  return { businessId, branchId, storeId };
}

// GET /api/reports/movement
router.get('/movement', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId, storeId } = await resolveReportScope(req);
    const movementType = req.query.movement_type || null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    let query = `
      SELECT 
        m.*,
        p.sku AS item_code,
        p.name AS item_name,
        p.category AS category,
        b.name AS branch_name,
        biz.name AS business_name,
        st.name AS store_name,
        u.full_name AS performed_by_name,
        u.email AS performed_by_email
      FROM stock_movements m
      JOIN products p ON m.item_id = p.id
      JOIN branches b ON m.branch_id = b.id
      LEFT JOIN businesses biz ON b.business_id = biz.id
      LEFT JOIN stores st ON m.store_id = st.id
      LEFT JOIN users u ON m.performed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (businessId) {
      query += ` AND b.business_id = ?`;
      params.push(businessId);
    }

    if (branchId) {
      query += ` AND m.branch_id = ?`;
      params.push(branchId);
    }

    if (storeId) {
      query += ` AND m.store_id = ?`;
      params.push(storeId);
    }

    if (movementType && movementType !== 'all') {
      query += ` AND m.movement_type = ?`;
      params.push(movementType);
    }

    if (startDate) {
      query += ` AND DATE(m.created_at) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND DATE(m.created_at) <= ?`;
      params.push(endDate);
    }

    // Exclude any movements from deleted damage reports or obsolete deletion reversal adjustments
    query += `
      AND (
        m.movement_type != 'damage' 
        OR m.note NOT LIKE 'Damage Report #%'
        OR CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(m.note, ':', 1), '#', -1) AS UNSIGNED) IN (SELECT id FROM damage_reports)
      )
      AND (m.note NOT LIKE 'Damage Report #% deleted%')
    `;

    query += ` ORDER BY m.created_at DESC LIMIT 300`;

    const [movements] = await pool.query(query, params);

    return res.json({
      success: true,
      movements
    });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    console.error('Movement report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch movement reports: ' + err.message });
  }
});

// GET /api/reports/summary - Summary KPI metrics
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId, storeId } = await resolveReportScope(req);
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (businessId) {
      whereClause += ' AND b.business_id = ?';
      params.push(businessId);
    }
    if (branchId) {
      whereClause += ' AND m.branch_id = ?';
      params.push(branchId);
    }
    if (storeId) {
      whereClause += ' AND m.store_id = ?';
      params.push(storeId);
    }
    if (startDate) {
      whereClause += ' AND DATE(m.created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND DATE(m.created_at) <= ?';
      params.push(endDate);
    }

    const [summaryRows] = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN m.movement_type = 'in' THEN m.quantity ELSE 0 END) as stock_in_qty,
        SUM(CASE WHEN m.movement_type = 'out' THEN m.quantity ELSE 0 END) as stock_out_qty,
        SUM(CASE WHEN m.movement_type = 'adjust' THEN m.quantity ELSE 0 END) as adjust_qty,
        SUM(CASE WHEN m.movement_type = 'damage' THEN m.quantity ELSE 0 END) as damaged_qty,
        COUNT(CASE WHEN m.movement_type = 'damage' THEN 1 END) as damaged_count
      FROM stock_movements m
      JOIN products p ON m.item_id = p.id
      JOIN branches b ON m.branch_id = b.id
      ${whereClause}
      AND (
        m.movement_type != 'damage' 
        OR m.note NOT LIKE 'Damage Report #%'
        OR CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(m.note, ':', 1), '#', -1) AS UNSIGNED) IN (SELECT id FROM damage_reports)
      )
      AND (m.note NOT LIKE 'Damage Report #% deleted%')
    `, params);

    const summary = summaryRows[0] || {};

    return res.json({
      success: true,
      data: {
        total_transactions: summary.total_transactions || 0,
        stock_in_qty: Number(summary.stock_in_qty) || 0,
        stock_out_qty: Number(summary.stock_out_qty) || 0,
        adjust_qty: Number(summary.adjust_qty) || 0,
        damaged_qty: Number(summary.damaged_qty) || 0,
        damaged_count: Number(summary.damaged_count) || 0
      }
    });

  } catch (err) {
    if (handleScopeError(res, err)) return;
    console.error('Summary report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch summary: ' + err.message });
  }
});

module.exports = router;
