const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');

// GET /:id - get store detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [stores] = await pool.query(`
      SELECT s.*, b.name as branch_name, biz.name as business_name
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

// POST / - create store event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      branch_id,
      name,
      venue,
      start_date,
      end_date,
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

    // Determine initial status based on start/end dates
    const today = new Date().toISOString().split('T')[0];
    let initialStatus = 'upcoming';
    if (start_date <= today && end_date >= today) {
      initialStatus = 'active';
    } else if (end_date < today) {
      initialStatus = 'ended';
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
      start_date,
      end_date,
      person_in_charge || null,
      contact_phone || null,
      notes || null,
      initialStatus
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'CREATE_STORE', 'stores', result.insertId, null, { branch_id, name, start_date, end_date }, req);

    return res.json({ success: true, message: `Store event '${name.trim()}' created successfully!`, data: { id: result.insertId } });
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

    return res.json({ success: true, message: `Store event '${stores[0].name}' marked as ended.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id - update store details
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      venue,
      start_date,
      end_date,
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

    const newStatus = status || existing[0].status;
    const endedAt = newStatus === 'ended' && existing[0].status !== 'ended' ? new Date() : existing[0].ended_at;

    await pool.query(`
      UPDATE stores SET 
        name = ?, venue = ?, start_date = ?, end_date = ?, person_in_charge = ?,
        contact_phone = ?, notes = ?, status = ?, ended_at = ?
      WHERE id = ?
    `, [
      name.trim(),
      venue || null,
      start_date || null,
      end_date || null,
      person_in_charge || null,
      contact_phone || null,
      notes || null,
      newStatus,
      endedAt,
      req.params.id
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_STORE', 'stores', req.params.id, existing[0], { name }, req);

    return res.json({ success: true, message: 'Store event details updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id - delete store (only if status === 'ended')
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const storeId = req.params.id;

    const [existing] = await pool.query('SELECT * FROM stores WHERE id = ?', [storeId]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Store not found' });
    
    if (existing[0].status !== 'ended') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete store event '${existing[0].name}': Only ended store events can be deleted. Please mark the store event as ended first.`
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
