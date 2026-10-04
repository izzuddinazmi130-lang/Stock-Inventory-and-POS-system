const express = require('express');
const router = express.Router();
const { salesReport } = require('../utils/salesReport');
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');
const { resolveScope, handleScopeError } = require('../middleware/scope');

// Helper to normalize date/time input to 'YYYY-MM-DD HH:mm:ss'
function normalizeDateTime(val, isEnd = false) {
  if (!val) return null;
  let str = String(val).trim();
  // Handle 'YYYY-MM-DDTHH:mm' or 'YYYY-MM-DDTHH:mm:ss'
  str = str.replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return isEnd ? `${str} 23:59:59` : `${str} 00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) {
    return `${str}:00`;
  }
  return str;
}

// Auto-sync store statuses based on current timestamp
async function syncStoreStatuses() {
  try {
    // 1. Mark ended if past end_date and not already ended
    await pool.query(`
      UPDATE stores 
      SET status = 'ended', ended_at = COALESCE(ended_at, end_date, NOW())
      WHERE status != 'ended' AND end_date IS NOT NULL AND end_date < NOW()
    `);
    // 2. Mark active if current time is within [start_date, end_date]
    await pool.query(`
      UPDATE stores
      SET status = 'active'
      WHERE status = 'upcoming' 
        AND start_date IS NOT NULL 
        AND start_date <= NOW() 
        AND (end_date IS NULL OR end_date >= NOW())
    `);
    // 3. Mark upcoming if start_date is in future
    await pool.query(`
      UPDATE stores
      SET status = 'upcoming'
      WHERE status = 'active' 
        AND start_date IS NOT NULL 
        AND start_date > NOW()
    `);
  } catch (err) {
    console.error('Error syncing store statuses:', err);
  }
}

// Branch admin may only access stores of their own branch. Sends 404/403 and returns false otherwise.
async function assertStoreAccess(req, res, storeId) {
  const [rows] = await pool.query('SELECT branch_id FROM stores WHERE id = ?', [storeId]);
  if (rows.length === 0) {
    res.status(404).json({ success: false, message: 'Store not found' });
    return false;
  }
  if (req.user.role !== 'super_admin' && (!req.user.branch_id || parseInt(req.user.branch_id, 10) !== rows[0].branch_id)) {
    res.status(403).json({ success: false, message: 'Access denied: this store does not belong to your branch.' });
    return false;
  }
  return true;
}

// GET / - every pop-up store in scope with its takings (from sales), live ones first.
// Branch admin: own branch only. Super admin: optional ?business_id / ?branch_id.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
    await syncStoreStatuses();

    const where = ['1=1'];
    const params = [];
    if (businessId) { where.push('br.business_id = ?'); params.push(businessId); }
    if (branchId) { where.push('st.branch_id = ?'); params.push(branchId); }

    const [stores] = await pool.query(
      `SELECT st.id, st.name, st.venue, st.status, st.start_date, st.end_date, st.ended_at, st.person_in_charge,
              st.branch_id, br.name AS branch_name, br.business_id, b.name AS business_name,
              COUNT(s.id) AS sales_count,
              COALESCE(SUM(s.total_amount), 0) AS revenue,
              COALESCE(SUM(s.total_quantity), 0) AS units,
              COALESCE(SUM(CASE WHEN DATE(s.created_at) = CURDATE() THEN s.total_amount END), 0) AS today_revenue,
              COALESCE(SUM(DATE(s.created_at) = CURDATE()), 0) AS today_sales,
              MAX(s.created_at) AS last_sale_at
       FROM stores st
       JOIN branches br ON br.id = st.branch_id
       JOIN businesses b ON b.id = br.business_id
       LEFT JOIN sales s ON s.store_id = st.id
       WHERE ${where.join(' AND ')}
       GROUP BY st.id
       ORDER BY FIELD(st.status, 'active', 'upcoming', 'ended'),
                CASE WHEN st.status = 'upcoming' THEN st.start_date END ASC,
                st.start_date DESC, st.id DESC`,
      params
    );

    return res.json({
      success: true,
      stores: stores.map(s => ({
        ...s,
        sales_count: Number(s.sales_count) || 0,
        revenue: parseFloat(s.revenue) || 0,
        units: Number(s.units) || 0,
        today_revenue: parseFloat(s.today_revenue) || 0,
        today_sales: Number(s.today_sales) || 0,
      })),
    });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    console.error('Store list error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load pop-up stores: ' + err.message });
  }
});

// GET /:id - get store detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (!(await assertStoreAccess(req, res, req.params.id))) return;
    await syncStoreStatuses();

    const [stores] = await pool.query(`
      SELECT s.*, b.name as branch_name, biz.name as business_name, biz.id as business_id
      FROM stores s
      JOIN branches b ON s.branch_id = b.id
      LEFT JOIN businesses biz ON b.business_id = biz.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (stores.length === 0) return res.status(404).json({ success: false, message: 'Store not found' });
    return res.json({ success: true, data: stores[0], store: stores[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST / - create store event with exact date and time
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      branch_id,
      name,
      venue,
      start_date,
      start_time,
      end_date,
      end_time,
      person_in_charge,
      contact_phone,
      notes
    } = req.body;

    if (!branch_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Branch selection and Store/Event Name are required' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Start Date and End Date are required for store events' });
    }

    if (req.user.role === 'admin' && req.user.branch_id !== parseInt(branch_id)) {
      return res.status(403).json({ success: false, message: 'Access denied: can only create stores for your assigned branch' });
    }

    const [branches] = await pool.query('SELECT id FROM branches WHERE id = ?', [branch_id]);
    if (branches.length === 0) return res.status(400).json({ success: false, message: 'Branch does not exist' });

    // Combine date + time if provided separately, or normalize
    let finalStart = normalizeDateTime(start_time ? `${start_date} ${start_time}` : start_date, false);
    let finalEnd   = normalizeDateTime(end_time ? `${end_date} ${end_time}` : end_date, true);

    const sTime = new Date(finalStart).getTime();
    const eTime = new Date(finalEnd).getTime();

    if (isNaN(sTime) || isNaN(eTime)) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date/time format' });
    }

    if (eTime < sTime) {
      return res.status(400).json({ success: false, message: 'End date and time cannot be earlier than start date and time' });
    }

    // Determine initial status based on exact current timestamp
    const now = Date.now();
    let initialStatus = 'upcoming';
    if (now > eTime) {
      initialStatus = 'ended';
    } else if (now >= sTime && now <= eTime) {
      initialStatus = 'active';
    } else {
      initialStatus = 'upcoming';
    }

    const [result] = await pool.query(`
      INSERT INTO stores (
        branch_id, name, venue, start_date, end_date, person_in_charge,
        contact_phone, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      branch_id,
      name.trim(),
      venue || null,
      finalStart,
      finalEnd,
      person_in_charge || null,
      contact_phone || null,
      notes || null,
      initialStatus
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'CREATE_STORE', 'stores', result.insertId, null, { branch_id, name, start_date: finalStart, end_date: finalEnd, status: initialStatus }, req);

    return res.json({
      success: true,
      message: `Store event '${name.trim()}' scheduled successfully! Status: ${initialStatus.toUpperCase()}`,
      data: { id: result.insertId, status: initialStatus }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/close - mark store as 'ended'
router.put('/:id/close', authenticateToken, async (req, res) => {
  try {
    const [stores] = await pool.query('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    if (stores.length === 0) return res.status(404).json({ success: false, message: 'Store not found' });
    
    if (req.user.role === 'admin' && req.user.branch_id !== stores[0].branch_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query("UPDATE stores SET status = 'ended', ended_at = NOW() WHERE id = ?", [req.params.id]);
    
    await recordAuditLog(req.user.id, req.user.role, 'CLOSE_STORE', 'stores', req.params.id, { status: stores[0].status }, { status: 'ended' }, req);

    return res.json({ success: true, message: `Store event '${stores[0].name}' closed and marked as ended.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id - update store details & exact datetime
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      venue,
      start_date,
      start_time,
      end_date,
      end_time,
      person_in_charge,
      contact_phone,
      notes,
      status
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Store name is required' });

    const [existing] = await pool.query('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Store not found' });

    if (req.user.role === 'admin' && req.user.branch_id !== existing[0].branch_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let finalStart = normalizeDateTime(start_time ? `${start_date} ${start_time}` : start_date, false) || existing[0].start_date;
    let finalEnd   = normalizeDateTime(end_time ? `${end_date} ${end_time}` : end_date, true) || existing[0].end_date;

    const sTime = new Date(finalStart).getTime();
    const eTime = new Date(finalEnd).getTime();

    if (eTime < sTime) {
      return res.status(400).json({ success: false, message: 'End date and time cannot be earlier than start date and time' });
    }

    // Determine status automatically if not manually forced
    let newStatus = status;
    const now = Date.now();
    if (!newStatus || newStatus === 'auto') {
      if (existing[0].ended_at && new Date(existing[0].ended_at).getTime() <= now) {
        newStatus = 'ended';
      } else if (now > eTime) {
        newStatus = 'ended';
      } else if (now >= sTime && now <= eTime) {
        newStatus = 'active';
      } else {
        newStatus = 'upcoming';
      }
    }

    const endedAt = newStatus === 'ended' && existing[0].status !== 'ended' ? new Date() : existing[0].ended_at;

    await pool.query(`
      UPDATE stores SET 
        name = ?, venue = ?, start_date = ?, end_date = ?, person_in_charge = ?,
        contact_phone = ?, notes = ?, status = ?, ended_at = ?
      WHERE id = ?
    `, [
      name.trim(),
      venue || null,
      finalStart,
      finalEnd,
      person_in_charge || null,
      contact_phone || null,
      notes || null,
      newStatus,
      endedAt,
      req.params.id
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_STORE', 'stores', req.params.id, existing[0], { name, status: newStatus }, req);

    return res.json({ success: true, message: 'Store event details updated successfully!', status: newStatus });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id - delete store (only if ended or upcoming, blocked if currently active)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const storeId = req.params.id;

    await syncStoreStatuses();

    const [existing] = await pool.query('SELECT * FROM stores WHERE id = ?', [storeId]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Store not found' });
    
    if (req.user.role !== 'super_admin') {
      if (req.user.role !== 'admin' || parseInt(req.user.branch_id, 10) !== parseInt(existing[0].branch_id, 10)) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only delete stores for your assigned branch.' });
      }
    }

    // Disallow deleting while currently active / in progress
    if (existing[0].status === 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete store event '${existing[0].name}': It is currently active/in progress. Please end the event first.`
      });
    }

    await pool.query('DELETE FROM stores WHERE id = ?', [storeId]);
    
    await recordAuditLog(req.user.id, req.user.role, 'DELETE_STORE', 'stores', storeId, existing[0], null, req);

    return res.json({ success: true, message: `Store event '${existing[0].name}' deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/report - takings at this pop-up store, from its receipts (one line per item sold)
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    if (!(await assertStoreAccess(req, res, req.params.id))) return;
    await syncStoreStatuses();
    const report = await salesReport(pool, 's.store_id = ?', [parseInt(req.params.id, 10)], { sort: req.query.sort });
    return res.json({ success: true, lines: report.lines, movements: report.lines, data: report.lines, summary: report.summary, truncated: report.truncated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/payment-breakdown
router.get('/:id/payment-breakdown', authenticateToken, async (req, res) => {
  try {
    if (!(await assertStoreAccess(req, res, req.params.id))) return;
    const [rows] = await pool.query(`
      SELECT payment_method,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total_quantity), 0) AS total_qty,
        COALESCE(SUM(total_amount), 0) AS total_amount
      FROM sales
      WHERE store_id = ?
      GROUP BY payment_method
    `, [req.params.id]);
    return res.json({ success: true, breakdown: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.syncStoreStatuses = syncStoreStatuses;
