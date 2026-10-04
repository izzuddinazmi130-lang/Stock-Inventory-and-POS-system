const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');
const { authenticateToken, recordAuditLog } = require('../middleware/auth');
const { resolveScope, handleScopeError } = require('../middleware/scope');
const { emitToBusiness } = require('../utils/realtime');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/damage-reports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'damage-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP image files are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter
});


// --- GET /api/damage-reports --------------------------------------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Admin: always their own business, all branches by default, optionally one sibling branch.
    // Super admin: any business / branch / all. Stats below are computed from the same scoped rows.
    const { businessId, branchId } = await resolveScope(req, { level: 'business' });
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let query = `
      SELECT 
        dr.id, dr.product_id, dr.business_id, dr.branch_id, dr.quantity,
        dr.cost_per_unit, dr.total_value, dr.reason_category, dr.reason_details,
        dr.reported_by, dr.created_at,
        p.sku as item_code, p.name as item_name, p.category,
        b.name as business_name,
        br.name as branch_name, br.branch_code,
        u.full_name as reported_by_name, u.email as reported_by_email
      FROM damage_reports dr
      JOIN products p ON dr.product_id = p.id
      JOIN businesses b ON dr.business_id = b.id
      JOIN branches br ON dr.branch_id = br.id
      LEFT JOIN users u ON dr.reported_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (businessId) {
      query += ' AND dr.business_id = ?';
      params.push(businessId);
    }
    if (branchId) {
      query += ' AND dr.branch_id = ?';
      params.push(branchId);
    }
    if (startDate) {
      query += ' AND DATE(dr.created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(dr.created_at) <= ?';
      params.push(endDate);
    }
    if (search) {
      query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR u.full_name LIKE ? OR dr.reason_details LIKE ?)';
      params.push(search, search, search, search);
    }

    query += ' ORDER BY dr.created_at DESC';

    const [reports] = await pool.query(query, params);

    // Fetch photos for all returned reports
    const reportIds = reports.map(r => r.id);
    const photoMap = {};
    if (reportIds.length > 0) {
      const [photos] = await pool.query(
        'SELECT id, damage_report_id, photo_path, uploaded_at FROM damage_report_photos WHERE damage_report_id IN (?)',
        [reportIds]
      );
      photos.forEach(p => {
        if (!photoMap[p.damage_report_id]) photoMap[p.damage_report_id] = [];
        photoMap[p.damage_report_id].push(p);
      });
    }

    reports.forEach(r => {
      r.photos = photoMap[r.id] || [];
    });

    // Compute live KPI metrics respecting the active filters
    const stats = {
      totalReports: reports.length,
      totalQuantity: reports.reduce((sum, r) => sum + parseInt(r.quantity || 0, 10), 0),
      totalValue: reports.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0)
    };

    return res.json({ success: true, reports, stats });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    console.error('Fetch damage reports error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch damage reports: ' + err.message });
  }
});

// --- GET /api/damage-reports/:id ----------------------------------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [reports] = await pool.query(`
      SELECT 
        dr.*,
        p.sku as item_code, p.name as item_name, p.category, p.description,
        b.name as business_name,
        br.name as branch_name, br.branch_code,
        u.full_name as reported_by_name, u.email as reported_by_email
      FROM damage_reports dr
      JOIN products p ON dr.product_id = p.id
      JOIN businesses b ON dr.business_id = b.id
      JOIN branches br ON dr.branch_id = br.id
      LEFT JOIN users u ON dr.reported_by = u.id
      WHERE dr.id = ?
    `, [req.params.id]);

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Damage report not found.' });
    }

    const report = reports[0];
    // Branch admin: may read any report within their own business, never another business's
    if (req.user.role !== 'super_admin' && (!req.user.business_id || report.business_id !== parseInt(req.user.business_id, 10))) {
      return res.status(404).json({ success: false, message: 'Damage report not found.' });
    }

    const [photos] = await pool.query(
      'SELECT id, photo_path, uploaded_at FROM damage_report_photos WHERE damage_report_id = ?',
      [report.id]
    );
    report.photos = photos;

    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- POST /api/damage-reports -------------------------------------------------
router.post('/', authenticateToken, upload.array('photos', 5), async (req, res) => {
  // A rejected or failed report must not leave its uploaded photos behind on disk
  res.on('finish', () => {
    if (res.statusCode >= 400 && Array.isArray(req.files)) {
      req.files.forEach(file => fs.unlink(file.path, () => {}));
    }
  });
  const connection = await pool.getConnection();
  try {
    const {
      product_id,
      branch_id,
      quantity,
      cost_per_unit,
      reason_category,
      reason_details
    } = req.body;

    if (!product_id || !branch_id || !quantity || parseInt(quantity, 10) <= 0 || !reason_category) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Product, branch, positive quantity, and damage reason category are required.'
      });
    }

    // Write actions stay branch-restricted: an admin may only report damage for their own branch
    const targetBranch = parseInt(branch_id, 10);
    if (!targetBranch) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Valid branch selection is required.' });
    }

    if (req.user.role !== 'super_admin' && (!req.user.branch_id || targetBranch !== parseInt(req.user.branch_id, 10))) {
      connection.release();
      return res.status(403).json({ success: false, message: 'Unauthorized branch for damage reporting.' });
    }

    const validCategories = ['transit_damage', 'breakage', 'water_damage', 'expired', 'manufacturing_defect', 'other'];
    if (!validCategories.includes(reason_category)) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Invalid reason category.' });
    }

    const damageQty = parseInt(quantity, 10);
    await connection.beginTransaction();

    // Verify Product
    const [products] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [product_id]);
    if (products.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const product = products[0];

    // Verify Branch & Business
    const [branches] = await connection.query('SELECT business_id, name FROM branches WHERE id = ?', [targetBranch]);
    if (branches.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }
    const businessId = branches[0].business_id;
    if (product.business_id !== businessId) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'This product does not belong to the business of this branch.' });
    }

    // Check branch stock
    const [stocks] = await connection.query(
      'SELECT * FROM product_branch_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE',
      [product_id, targetBranch]
    );
    if (stocks.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'No stock record found for this product at this branch.' });
    }

    const curQty = parseInt(stocks[0].quantity || 0, 10);
    if (curQty < damageQty) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock to log damage. Available at branch: ${curQty} units, requested damage: ${damageQty} units.`
      });
    }

    // Snapshot cost per unit & total value
    const snapshotCost = cost_per_unit !== undefined && cost_per_unit !== '' && !isNaN(parseFloat(cost_per_unit)) && parseFloat(cost_per_unit) >= 0 
      ? parseFloat(cost_per_unit) 
      : parseFloat(product.cost_price || 0.00);
    const totalValue = snapshotCost * damageQty;

    // 1. Insert Damage Report
    const [reportResult] = await connection.query(
      `INSERT INTO damage_reports 
        (product_id, business_id, branch_id, quantity, cost_per_unit, total_value, reason_category, reason_details, reported_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [product_id, businessId, targetBranch, damageQty, snapshotCost, totalValue, reason_category, reason_details ? reason_details.trim() : null, req.user.id]
    );
    const reportId = reportResult.insertId;

    // 2. Insert Photos if uploaded
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const relativePath = `/uploads/damage-reports/${file.filename}`;
        await connection.query(
          'INSERT INTO damage_report_photos (damage_report_id, photo_path, uploaded_at) VALUES (?, ?, NOW())',
          [reportId, relativePath]
        );
      }
    }

    // 3. Decrement Branch Stock
    const newQty = curQty - damageQty;
    await connection.query(
      'UPDATE product_branch_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?',
      [newQty, product_id, targetBranch]
    );

    // 4. Log in stock_movements linked to damage_reports
    await connection.query(
      `INSERT INTO stock_movements
         (branch_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
       VALUES (?, ?, 'damage', ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        targetBranch,
        product_id,
        damageQty,
        curQty,
        newQty,
        snapshotCost,
        product.price_customer || 0.00,
        `Damage Report #${reportId}: ${reason_category}${reason_details ? ' - ' + reason_details.trim() : ''}`,
        req.user.id
      ]
    );

    await connection.commit();
    connection.release();

    // Audit Log
    await recordAuditLog(
      req.user.id,
      req.user.role,
      'CREATE_DAMAGE_REPORT',
      'damage_reports',
      reportId,
      null,
      { product_id, sku: product.sku, quantity: damageQty, total_value: totalValue, reason_category },
      req
    );

    // Emit live socket event
    emitToBusiness(req, businessId, 'inventory_updated', { branch_id: targetBranch, item_id: product_id, new_qty: newQty });
    emitToBusiness(req, businessId, 'damage_reported', { report_id: reportId, branch_id: targetBranch, product_id });

    return res.json({
      success: true,
      message: `Damage report #${reportId} logged successfully. Deducted ${damageQty} units from branch stock.`,
      reportId
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Create damage report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create damage report: ' + err.message });
  }
});

// --- DELETE /api/damage-reports/:id -------------------------------------------
router.delete('/:id', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId)) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Invalid damage report ID.' });
    }

    const [reports] = await connection.query(
      'SELECT * FROM damage_reports WHERE id = ?',
      [reportId]
    );
    if (reports.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Damage report not found.' });
    }
    const report = reports[0];

    // Branch-scoped admins may only delete records from their own branch
    if (req.user.role !== 'super_admin' && (!req.user.branch_id || report.branch_id !== parseInt(req.user.branch_id, 10))) {
      connection.release();
      return res.status(403).json({ success: false, message: 'Unauthorized to delete a damage report from another branch.' });
    }

    // Grab photo paths before delete so we can remove the files from disk afterwards
    const [photos] = await connection.query(
      'SELECT photo_path FROM damage_report_photos WHERE damage_report_id = ?',
      [reportId]
    );

    await connection.beginTransaction();

    // Restore the deducted stock back to the branch
    const [stocks] = await connection.query(
      'SELECT * FROM product_branch_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE',
      [report.product_id, report.branch_id]
    );

    let curQty = 0;
    let newQty = 0;
    if (stocks.length > 0) {
      curQty = parseInt(stocks[0].quantity || 0, 10);
      newQty = curQty + parseInt(report.quantity, 10);
      await connection.query(
        'UPDATE product_branch_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?',
        [newQty, report.product_id, report.branch_id]
      );
    }

    // Remove the damage stock movement created for this damage report so reports & analytics stay consistent
    await connection.query(
      `DELETE FROM stock_movements
       WHERE branch_id = ? AND item_id = ? AND (note LIKE ? OR note LIKE ?)`,
      [
        report.branch_id,
        report.product_id,
        `Damage Report #${reportId}:%`,
        `Damage Report #${reportId} %`
      ]
    );

    // damage_report_photos rows cascade-delete automatically via FK, but delete explicitly for clarity
    await connection.query('DELETE FROM damage_report_photos WHERE damage_report_id = ?', [reportId]);
    await connection.query('DELETE FROM damage_reports WHERE id = ?', [reportId]);

    await connection.commit();
    connection.release();

    // Remove evidence photo files from disk (best-effort, after commit)
    photos.forEach(p => {
      const filePath = path.join(__dirname, '../..', p.photo_path);
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error('Failed to delete damage photo file:', filePath, err.message);
        }
      });
    });

    await recordAuditLog(
      req.user.id,
      req.user.role,
      'DELETE_DAMAGE_REPORT',
      'damage_reports',
      reportId,
      { product_id: report.product_id, quantity: report.quantity, total_value: report.total_value },
      null,
      req
    );

    emitToBusiness(req, report.business_id, 'inventory_updated', { branch_id: report.branch_id, item_id: report.product_id, new_qty: newQty });
    emitToBusiness(req, report.business_id, 'damage_deleted', { report_id: reportId, branch_id: report.branch_id, product_id: report.product_id });

    return res.json({
      success: true,
      message: `Damage report #${reportId} deleted and ${report.quantity} unit(s) restored to branch stock.`
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Delete damage report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete damage report: ' + err.message });
  }
});

module.exports = router;