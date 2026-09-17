const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const pool = require('../config/db');
const { authenticateToken, recordAuditLog } = require('../middleware/auth');

// GET /api/qr/generate/:id  (product id)
router.get('/generate/:id', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);

    // Determine which branch to show stock for
    const branchId = req.user.role !== 'super_admin' && req.user.branch_id
      ? parseInt(req.user.branch_id)
      : null;

    let query = `
      SELECT
        p.id,
        p.sku        AS item_code,
        p.name       AS item_name,
        p.category,
        p.price_customer AS selling_price,
        p.price_dealer,
        p.price_staff,
        p.cost_price AS unit_price,
        p.status,
        pbs.branch_id,
        pbs.quantity,
        br.name        AS branch_name,
        br.branch_code
      FROM products p
      JOIN product_branch_stock pbs ON pbs.product_id = p.id
      JOIN branches br ON br.id = pbs.branch_id
      WHERE p.id = ?
    `;
    const params = [productId];

    if (branchId) {
      query += ' AND pbs.branch_id = ?';
      params.push(branchId);
    }

    query += ' LIMIT 1';

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const item = rows[0];

    // Branch isolation guard for non-super_admin
    if (req.user.role !== 'super_admin' && req.user.branch_id) {
      if (parseInt(item.branch_id) !== parseInt(req.user.branch_id)) {
        return res.status(403).json({ success: false, message: 'Access denied: this item belongs to another branch.' });
      }
    }

    const branchCode = item.branch_code || `BR${item.branch_id}`;
    const qrCodeString = `HQ-ITEM-${branchCode}-${item.item_code}`;

    // Generate SVG
    const svgContent = await QRCode.toString(qrCodeString, { type: 'svg', margin: 1, width: 260 });

    return res.json({
      success: true,
      qr_code: qrCodeString,
      qr_svg: svgContent,
      item
    });

  } catch (err) {
    console.error('QR generate error:', err);
    return res.status(500).json({ success: false, message: 'QR code generation failed: ' + err.message });
  }
});

// POST /api/qr/scan-deduct
router.post('/scan-deduct', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { qr_code, quantity, note } = req.body;

    if (!qr_code || !quantity || parseInt(quantity) <= 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Valid QR code or SKU and quantity > 0 are required.' });
    }

    let codeClean = qr_code.trim();
    // Parse format HQ-ITEM-{branchCode}-{item_code} if present
    const match = codeClean.match(/^HQ-ITEM-[^-]+-(.+)$/);
    if (match) {
      codeClean = match[1];
    }

    const qtyDeduct = parseInt(quantity);
    const saleNote = note ? note.trim() : 'Physical store walk-in sale via QR';

    await connection.beginTransaction();

    // Query product by SKU
    const [rows] = await connection.query(
      `SELECT
         p.id, p.sku AS item_code, p.name AS item_name,
         p.price_customer AS selling_price, p.cost_price AS unit_price,
         pbs.branch_id, pbs.quantity,
         br.name AS branch_name
       FROM products p
       JOIN product_branch_stock pbs ON pbs.product_id = p.id
       JOIN branches br ON br.id = pbs.branch_id
       WHERE p.sku = ? AND p.status != 'discontinued'
       FOR UPDATE`,
      [codeClean]
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: `Product not found with SKU/code: '${codeClean}'` });
    }

    // If user is branch-scoped, find their branch row; otherwise use the first
    let item = rows[0];
    if (req.user.role !== 'super_admin' && req.user.branch_id) {
      const branchRow = rows.find(r => parseInt(r.branch_id) === parseInt(req.user.branch_id));
      if (!branchRow) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({
          success: false,
          message: `Branch restriction: this item does not exist in your assigned branch.`
        });
      }
      item = branchRow;
    }

    const curQty = parseInt(item.quantity || 0);
    if (curQty < qtyDeduct) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for '${item.item_name}'. Available: ${curQty}, requested deduction: ${qtyDeduct}`
      });
    }

    const newQty = curQty - qtyDeduct;

    // Update product_branch_stock
    await connection.query(
      'UPDATE product_branch_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?',
      [newQty, item.id, item.branch_id]
    );

    // Update product status if needed
    if (newQty === 0) {
      await connection.query(
        "UPDATE products SET status = 'out_of_stock' WHERE id = ? AND status != 'discontinued'",
        [item.id]
      );
    } else {
      await connection.query(
        "UPDATE products SET status = 'available' WHERE id = ? AND status = 'out_of_stock'",
        [item.id]
      );
    }

    // Record stock movement
    await connection.query(
      `INSERT INTO stock_movements
         (branch_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, payment_method, note, performed_by, created_at)
       VALUES (?, ?, 'out', ?, ?, ?, ?, ?, 'qr', ?, ?, NOW())`,
      [
        item.branch_id,
        item.id,
        qtyDeduct,
        curQty,
        newQty,
        item.unit_price,
        item.selling_price,
        `[QR Scan] ${saleNote}`,
        req.user.id
      ]
    );

    await connection.commit();
    connection.release();

    await recordAuditLog(req.user.id, req.user.role, 'QR_SCAN_DEDUCT', 'products', item.id, { old_qty: curQty }, { new_qty: newQty, deducted: qtyDeduct }, req);

    // Broadcast real-time Socket.io update
    const io = req.app.get('io');
    if (io) {
      io.emit('inventory_updated', { branch_id: item.branch_id, item_id: item.id, new_qty: newQty, action: 'scan_deduct' });
    }

    return res.json({
      success: true,
      message: `Stock deducted successfully! Product: ${item.item_code} - ${item.item_name}. New balance: ${newQty}.`,
      item,
      qty_deducted: qtyDeduct,
      old_stock: curQty,
      new_stock: newQty
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Scan deduct error:', err);
    return res.status(500).json({ success: false, message: 'QR Deduction failed: ' + err.message });
  }
});

module.exports = router;
