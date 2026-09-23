const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');

// GET / - list branches. super_admin: all. admin: their business branches.
router.get('/', authenticateToken, async (req, res) => {
  try {
    let branches;
    if (req.user.role === 'super_admin') {
      [branches] = await pool.query('SELECT b.*, biz.name as business_name FROM branches b LEFT JOIN businesses biz ON b.business_id = biz.id ORDER BY b.name');
    } else {
      [branches] = await pool.query('SELECT b.*, biz.name as business_name FROM branches b LEFT JOIN businesses biz ON b.business_id = biz.id WHERE b.business_id = ? ORDER BY b.name', [req.user.business_id]);
    }
    return res.json({ success: true, data: branches, branches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST / - create branch (super_admin only)
router.post('/', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const {
      business_id,
      name,
      branch_code,
      address,
      city,
      state,
      postcode,
      contact_person,
      contact_phone,
      contact_email,
      operating_hours,
      opening_date
    } = req.body;

    if (!business_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Business selection and Branch Name are required' });
    }

    const [result] = await pool.query(`
      INSERT INTO branches (
        business_id, name, branch_code, address, city, state, postcode,
        contact_person, contact_phone, contact_email, operating_hours, opening_date, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `, [
      business_id,
      name.trim(),
      branch_code || null,
      address || null,
      city || null,
      state || null,
      postcode || null,
      contact_person || null,
      contact_phone || null,
      contact_email || null,
      operating_hours || null,
      opening_date || null
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'CREATE_BRANCH', 'branches', result.insertId, null, { business_id, name }, req);

    const io = req.app.get('io');
    if (io) io.emit('branch_updated', { branch_id: result.insertId, action: 'create' });

    return res.json({ success: true, message: `Branch '${name.trim()}' created successfully!`, data: { id: result.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id - get branch detail + admins + stats
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' && req.user.branch_id !== parseInt(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Access denied: not your branch' });
    }

    const [branches] = await pool.query(`
      SELECT b.*, biz.name AS business_name 
      FROM branches b 
      LEFT JOIN businesses biz ON b.business_id = biz.id 
      WHERE b.id = ?
    `, [req.params.id]);
    if (branches.length === 0) return res.status(404).json({ success: false, message: 'Branch not found' });

    const branch = branches[0];

    const [admins] = await pool.query('SELECT id, full_name, email, role FROM users WHERE branch_id = ? AND is_active = 1', [req.params.id]);
    branch.admins = admins;

    const [prodStats] = await pool.query(`
      SELECT 
        COUNT(*) as totalItems,
        COALESCE(SUM(quantity), 0) as totalStock,
        SUM(CASE WHEN quantity <= minimum_quantity THEN 1 ELSE 0 END) as lowStockCount
      FROM stock_items 
      WHERE branch_id = ? AND is_active = 1
    `, [req.params.id]);

    branch.stats = {
      totalItems: prodStats[0].totalItems || 0,
      totalStock: Number(prodStats[0].totalStock) || 0,
      lowStockCount: Number(prodStats[0].lowStockCount) || 0
    };

    return res.json({ success: true, data: branch, branch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/report - movement report for this branch
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' && req.user.branch_id !== parseInt(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Access denied: not your branch' });
    }

    const [report] = await pool.query(`
      SELECT sm.*, si.item_code, si.item_name, si.category, b.name AS branch_name, u.full_name AS performed_by_name 
      FROM stock_movements sm 
      JOIN stock_items si ON sm.item_id = si.id 
      JOIN branches b ON sm.branch_id = b.id 
      LEFT JOIN users u ON sm.performed_by = u.id 
      WHERE sm.branch_id = ? 
      ORDER BY sm.created_at DESC
    `, [req.params.id]);
    return res.json({ success: true, data: report, report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/stores - list stores for this branch
router.get('/:id/stores', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' && req.user.branch_id !== parseInt(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Access denied: not your branch' });
    }

    // Auto-sync dynamic store statuses based on current timestamp
    await pool.query(`
      UPDATE stores 
      SET status = 'ended', ended_at = COALESCE(ended_at, end_date, NOW())
      WHERE status != 'ended' AND end_date IS NOT NULL AND end_date < NOW()
    `);
    await pool.query(`
      UPDATE stores
      SET status = 'active'
      WHERE status = 'upcoming' 
        AND start_date IS NOT NULL 
        AND start_date <= NOW() 
        AND (end_date IS NULL OR end_date >= NOW())
    `);
    await pool.query(`
      UPDATE stores
      SET status = 'upcoming'
      WHERE status = 'active' 
        AND start_date IS NOT NULL 
        AND start_date > NOW()
    `);

    const [stores] = await pool.query('SELECT * FROM stores WHERE branch_id = ? ORDER BY created_at DESC', [req.params.id]);
    return res.json({ success: true, data: stores, stores });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/floor-report - "Branch Floor (Main)" walk-in sales (store_id IS NULL)
router.get('/:id/floor-report', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' && req.user.branch_id !== parseInt(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Access denied: not your branch' });
    }
    const paymentMethod = req.query.payment_method || null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const sort = req.query.sort || 'date_desc';

    let query = `
      SELECT sm.*, p.sku AS item_code, p.name AS item_name, p.category AS category,
             u.full_name AS performed_by_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.item_id = p.id
      LEFT JOIN users u ON sm.performed_by = u.id
      WHERE sm.branch_id = ? AND sm.store_id IS NULL AND sm.movement_type = 'out'
    `;
    const params = [req.params.id];
    if (paymentMethod && paymentMethod !== 'all') { query += ' AND sm.payment_method = ?'; params.push(paymentMethod); }
    if (startDate) { query += ' AND DATE(sm.created_at) >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND DATE(sm.created_at) <= ?'; params.push(endDate); }

    const sortMap = {
      date_desc: 'sm.created_at DESC', date_asc: 'sm.created_at ASC',
      amount_desc: '(COALESCE(sm.selling_price,0) * sm.quantity) DESC',
      amount_asc: '(COALESCE(sm.selling_price,0) * sm.quantity) ASC',
      qty_desc: 'sm.quantity DESC', qty_asc: 'sm.quantity ASC'
    };
    query += ` ORDER BY ${sortMap[sort] || sortMap.date_desc} LIMIT 500`;

    const [movements] = await pool.query(query, params);
    let totalCash = 0, totalQr = 0, totalOnline = 0, totalItemsSold = 0;
    movements.forEach(m => {
      const val = (m.selling_price || 0) * m.quantity;
      totalItemsSold += m.quantity;
      if (m.payment_method === 'cash') totalCash += val;
      else if (m.payment_method === 'qr') totalQr += val;
      else if (m.payment_method === 'online_banking') totalOnline += val;
    });

    return res.json({
      success: true, data: movements, movements,
      summary: { total_cash: totalCash, total_qr: totalQr, total_online: totalOnline,
        total_sales: totalCash + totalQr + totalOnline, total_items_sold: totalItemsSold,
        total_transactions: movements.length }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id - update branch (super_admin only)
router.put('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const {
      name,
      branch_code,
      address,
      city,
      state,
      postcode,
      contact_person,
      contact_phone,
      contact_email,
      operating_hours,
      opening_date,
      is_active
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Branch Name is required' });

    const [existing] = await pool.query('SELECT * FROM branches WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Branch not found' });

    await pool.query(`
      UPDATE branches SET 
        name = ?, branch_code = ?, address = ?, city = ?, state = ?, postcode = ?,
        contact_person = ?, contact_phone = ?, contact_email = ?, operating_hours = ?,
        opening_date = ?, is_active = ?
      WHERE id = ?
    `, [
      name.trim(),
      branch_code || null,
      address || null,
      city || null,
      state || null,
      postcode || null,
      contact_person || null,
      contact_phone || null,
      contact_email || null,
      operating_hours || null,
      opening_date || null,
      is_active !== undefined ? is_active : existing[0].is_active,
      req.params.id
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_BRANCH', 'branches', req.params.id, existing[0], { name }, req);

    const io = req.app.get('io');
    if (io) io.emit('branch_updated', { branch_id: req.params.id, action: 'update' });

    return res.json({ success: true, message: 'Branch details updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id - delete branch (super_admin only with deletion protection)
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const branchId = req.params.id;

    const [existing] = await pool.query('SELECT * FROM branches WHERE id = ?', [branchId]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Branch not found' });

    // Block deletion if active or upcoming stores exist under this branch
    const [stores] = await pool.query(`
      SELECT COUNT(*) as count FROM stores 
      WHERE branch_id = ? AND status IN ('active', 'upcoming')
    `, [branchId]);

    if (stores[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch '${existing[0].name}': It has ${stores[0].count} active or upcoming store event(s). Please end or delete those store events first.`
      });
    }

    await pool.query('DELETE FROM branches WHERE id = ?', [branchId]);

    await recordAuditLog(req.user.id, req.user.role, 'DELETE_BRANCH', 'branches', branchId, existing[0], null, req);

    const io = req.app.get('io');
    if (io) io.emit('branch_updated', { branch_id: branchId, action: 'delete' });

    return res.json({ success: true, message: `Branch '${existing[0].name}' deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
