const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');

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

// GET /:id - get store detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
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

// GET /:id/report - store sales & movement report with payment method breakdown
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    await syncStoreStatuses();

    const [movements] = await pool.query(`
      SELECT sm.*, 
        COALESCE(p.sku, si.item_code) as item_code, 
        COALESCE(p.name, si.item_name) as item_name, 
        COALESCE(p.category, si.category) as category, 
        sm.payment_method 
      FROM stock_movements sm 
      LEFT JOIN products p ON sm.item_id = p.id
      LEFT JOIN stock_items si ON sm.item_id = si.id 
      WHERE sm.store_id = ? 
      ORDER BY sm.created_at DESC
    `, [req.params.id]);

    let totalCash = 0;
    let totalOnline = 0;
    let totalItemsSold = 0;

    movements.forEach(m => {
      const val = (m.selling_price || 0) * m.quantity;
      if (m.movement_type === 'out') {
        totalItemsSold += m.quantity;
      }
      if (m.payment_method === 'cash') {
        totalCash += val;
      } else if (m.payment_method === 'qr' || m.payment_method === 'online_banking') {
        totalOnline += val;
      }
    });

    return res.json({ 
      success: true, 
      data: movements,
      movements,
      summary: {
        total_cash: totalCash,
        total_online: totalOnline,
        total_sales: totalCash + totalOnline,
        total_items_sold: totalItemsSold
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/payment-breakdown
router.get('/:id/payment-breakdown', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COALESCE(payment_method, 'cash') as payment_method,
        COUNT(*) as transaction_count,
        SUM(quantity) as total_qty,
        SUM(COALESCE(selling_price, 0) * quantity) as total_amount
      FROM stock_movements
      WHERE store_id = ? AND movement_type = 'out'
      GROUP BY payment_method
    `, [req.params.id]);
    return res.json({ success: true, breakdown: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.syncStoreStatuses = syncStoreStatuses;
