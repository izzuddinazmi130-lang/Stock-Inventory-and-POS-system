const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const pool = require('../config/db');
const { authenticateToken, recordAuditLog } = require('../middleware/auth');

// Helper to extract clean SKU from scanned QR string
function parseQrCode(rawCode) {
  if (!rawCode) return '';
  let code = String(rawCode).trim();
  code = code.replace(/^["']|["']$/g, '');

  // Format 1: Strip HQ-ITEM- prefix if present
  if (code.startsWith('HQ-ITEM-')) {
    code = code.substring(8).trim();
  }

  // Format 2: HQ-{branchCode}-{sku}-{timestamp}
  const match2 = code.match(/^HQ-[^-]+-(.+)-[A-Z0-9]+$/);
  if (match2) return match2[1].trim();

  return code;
}

// ─── GET /api/qr/generate/:id  (product id) ──────────────────────────────────
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
    const qrCodeString = `HQ-${branchCode.toUpperCase()}-${item.item_code}-${item.id}`;

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

// ─── GET /api/qr/lookup ───────────────────────────────────────────────────────
// Looks up product details by scanned QR string or SKU with branch stock & tiered prices
router.get('/lookup', authenticateToken, async (req, res) => {
  try {
    const rawCode = req.query.code;
    if (!rawCode || !rawCode.trim()) {
      return res.status(400).json({ success: false, message: 'QR code or SKU is required.' });
    }

    const cleanCode = parseQrCode(rawCode);

    // Resolve branch
    let targetBranch = null;
    if (req.user.role !== 'super_admin') {
      targetBranch = req.user.branch_id ? parseInt(req.user.branch_id, 10) : null;
      if (!targetBranch) {
        return res.status(403).json({ success: false, message: 'Access denied: Branch Admin must have an assigned branch.' });
      }
    } else if (req.query.branch_id) {
      targetBranch = parseInt(req.query.branch_id, 10);
    }

    let query;
    let params;

    if (targetBranch) {
      query = `
        SELECT 
          p.id,
          p.sku,
          p.sku AS item_code,
          p.name,
          p.name AS item_name,
          p.category,
          p.description,
          p.price_customer,
          p.price_customer AS selling_price,
          p.price_dealer,
          p.price_staff,
          p.cost_price,
          p.status,
          p.min_quantity,
          p.business_id,
          biz.name AS business_name,
          COALESCE(pbs.quantity, 0) AS in_stock,
          COALESCE(pbs.quantity, 0) AS quantity,
          br.id AS branch_id,
          br.name AS branch_name
        FROM products p
        JOIN businesses biz ON p.business_id = biz.id
        JOIN branches br ON br.id = ? AND p.business_id = br.business_id
        LEFT JOIN product_branch_stock pbs ON pbs.product_id = p.id AND pbs.branch_id = br.id
        WHERE (
          p.sku = ?
          OR ? LIKE CONCAT('%', p.sku)
          OR ? LIKE CONCAT('%-', p.sku)
          OR ? LIKE CONCAT('%', p.sku, '%')
          OR p.name = ?
          OR CAST(p.id AS CHAR) = ?
        )
        AND p.status != 'discontinued'
        ORDER BY (p.sku = ?) DESC, LENGTH(p.sku) DESC
        LIMIT 1
      `;
      params = [targetBranch, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode];
    } else {
      query = `
        SELECT 
          p.id,
          p.sku,
          p.sku AS item_code,
          p.name,
          p.name AS item_name,
          p.category,
          p.description,
          p.price_customer,
          p.price_customer AS selling_price,
          p.price_dealer,
          p.price_staff,
          p.cost_price,
          p.status,
          p.min_quantity,
          p.business_id,
          biz.name AS business_name,
          0 AS in_stock,
          0 AS quantity,
          NULL AS branch_id,
          NULL AS branch_name
        FROM products p
        JOIN businesses biz ON p.business_id = biz.id
        WHERE (
          p.sku = ?
          OR ? LIKE CONCAT('%', p.sku)
          OR ? LIKE CONCAT('%-', p.sku)
          OR ? LIKE CONCAT('%', p.sku, '%')
          OR p.name = ?
          OR CAST(p.id AS CHAR) = ?
        )
        AND p.status != 'discontinued'
        ORDER BY (p.sku = ?) DESC, LENGTH(p.sku) DESC
        LIMIT 1
      `;
      params = [cleanCode, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode];
    }

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Product not found for code '${rawCode}'. Please check the SKU or branch assignment.`
      });
    }

    const product = rows[0];

    return res.json({
      success: true,
      product: {
        id: product.id,
        sku: product.sku,
        item_code: product.sku,
        name: product.name,
        item_name: product.name,
        category: product.category,
        description: product.description,
        price_customer: parseFloat(product.price_customer || 0),
        price_dealer: parseFloat(product.price_dealer || product.price_customer || 0),
        price_staff: parseFloat(product.price_staff || product.price_customer || 0),
        cost_price: parseFloat(product.cost_price || 0),
        status: product.status,
        min_quantity: product.min_quantity,
        business_id: product.business_id,
        business_name: product.business_name,
        branch_id: targetBranch,
        branch_name: product.branch_name,
        in_stock: parseInt(product.in_stock || 0),
        quantity: parseInt(product.in_stock || 0)
      }
    });

  } catch (err) {
    console.error('QR Lookup error:', err);
    return res.status(500).json({ success: false, message: 'QR Lookup failed: ' + err.message });
  }
});

// ─── POST /api/qr/pos-transaction ─────────────────────────────────────────────
// Full POS checkout for Branch Admin: supports Stock In (intake) and Stock Out (floor sale)
router.post('/pos-transaction', authenticateToken, async (req, res) => {
  // Super Admin is restricted to view-only oversight; POS operations are strictly for Branch Admins
  if (req.user.role === 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Super Admins cannot execute POS transactions. POS operations are restricted to Branch Admin operators.'
    });
  }

  const connection = await pool.getConnection();
  try {
    const {
      mode = 'stock_out', // 'stock_out' (Sale) or 'stock_in' (Restock)
      price_tier = 'customer', // 'customer', 'dealer', 'staff'
      payment_method = 'cash', // 'cash', 'qr', 'online_banking'
      store_id = null,
      note = '',
      items = []
    } = req.body;

    // Resolve target branch from authenticated branch admin
    const targetBranch = req.user.branch_id ? parseInt(req.user.branch_id, 10) : null;
    if (!targetBranch) {
      connection.release();
      return res.status(403).json({ success: false, message: 'You are not assigned to a branch.' });
    }

    // Support single item payload or multi-item cart array
    let cartItems = [];
    if (Array.isArray(items) && items.length > 0) {
      cartItems = items;
    } else if (req.body.product_id || req.body.qr_code || req.body.sku) {
      cartItems = [{
        product_id: req.body.product_id,
        qr_code: req.body.qr_code,
        sku: req.body.sku,
        quantity: parseInt(req.body.quantity || 1, 10)
      }];
    }

    if (cartItems.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'No items provided for POS transaction.' });
    }

    await connection.beginTransaction();

    const processedItems = [];
    let grandTotal = 0;
    let totalQuantity = 0;

    for (const item of cartItems) {
      const qty = parseInt(item.quantity || 1, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid quantity (${item.quantity}) for item.`);
      }

      // Look up product by id, sku, qr_code, or name with branch business isolation
      const rawItemCode = item.sku || item.qr_code || item.item_code || '';
      const cleanSku = parseQrCode(rawItemCode);

      const [pRows] = await connection.query(`
        SELECT p.* FROM products p
        JOIN branches br ON br.id = ? AND p.business_id = br.business_id
        WHERE (
          p.id = ?
          OR p.sku = ?
          OR ? LIKE CONCAT('%', p.sku)
          OR ? LIKE CONCAT('%-', p.sku)
          OR ? LIKE CONCAT('%', p.sku, '%')
          OR p.name = ?
        )
        AND p.status != 'discontinued'
        ORDER BY (p.sku = ?) DESC, LENGTH(p.sku) DESC
        LIMIT 1
      `, [
        targetBranch,
        item.product_id || 0,
        cleanSku || '',
        cleanSku || '',
        cleanSku || '',
        cleanSku || '',
        item.name || cleanSku || '',
        cleanSku || ''
      ]);

      const product = pRows.length > 0 ? pRows[0] : null;

      if (!product) {
        throw new Error(`Product not found or does not belong to this branch for: ${item.name || rawItemCode || item.product_id}`);
      }

      // Lock current branch stock row
      const [stocks] = await connection.query(
        'SELECT * FROM product_branch_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE',
        [product.id, targetBranch]
      );

      let curQty = 0;
      let newQty = 0;
      const stockRowExists = stocks.length > 0;

      if (stockRowExists) {
        curQty = parseInt(stocks[0].quantity || 0);
      }

      // Select price based on price tier
      let unitSellingPrice = parseFloat(product.price_customer || 0);
      const tier = item.price_tier || price_tier;
      if (tier === 'dealer') {
        unitSellingPrice = parseFloat(product.price_dealer || product.price_customer || 0);
      } else if (tier === 'staff') {
        unitSellingPrice = parseFloat(product.price_staff || product.price_customer || 0);
      }

      const costPrice = parseFloat(product.cost_price || 0);

      if (mode === 'stock_out') {
        // STOCK OUT (POS Floor Sale)
        if (curQty < qty) {
          throw new Error(`Insufficient stock for '${product.name}' (${product.sku}). Available: ${curQty}, requested: ${qty}`);
        }

        newQty = curQty - qty;

        if (stockRowExists) {
          await connection.query(
            'UPDATE product_branch_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?',
            [newQty, product.id, targetBranch]
          );
        } else {
          await connection.query(
            'INSERT INTO product_branch_stock (product_id, branch_id, quantity, created_at) VALUES (?, ?, ?, NOW())',
            [product.id, targetBranch, newQty]
          );
        }

        // Update product status if zero
        if (newQty === 0) {
          await connection.query(
            "UPDATE products SET status = 'out_of_stock' WHERE id = ? AND status != 'discontinued'",
            [product.id]
          );
        }

        const tierLabel = tier.toUpperCase();
        const saleRef = note ? note.trim() : 'POS Counter Sale';
        const movementNote = `[POS Sale - ${tierLabel}] ${saleRef}`;

        // Insert into stock_movements
        const [movResult] = await connection.query(
          `INSERT INTO stock_movements
             (branch_id, store_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, payment_method, note, performed_by, created_at)
           VALUES (?, ?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            targetBranch,
            store_id ? parseInt(store_id) : null,
            product.id,
            qty,
            curQty,
            newQty,
            costPrice,
            unitSellingPrice,
            payment_method,
            movementNote,
            req.user.id
          ]
        );

        const lineTotal = unitSellingPrice * qty;
        grandTotal += lineTotal;
        totalQuantity += qty;

        processedItems.push({
          movement_id: movResult.insertId,
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          quantity: qty,
          old_stock: curQty,
          new_stock: newQty,
          price_tier: tier,
          unit_price: unitSellingPrice,
          line_total: lineTotal
        });

      } else {
        // STOCK IN (Intake / Restock)
        newQty = curQty + qty;

        if (stockRowExists) {
          await connection.query(
            'UPDATE product_branch_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?',
            [newQty, product.id, targetBranch]
          );
        } else {
          await connection.query(
            'INSERT INTO product_branch_stock (product_id, branch_id, quantity, created_at) VALUES (?, ?, ?, NOW())',
            [product.id, targetBranch, newQty]
          );
        }

        // Restore status if was out of stock
        if (curQty === 0 && newQty > 0) {
          await connection.query(
            "UPDATE products SET status = 'available' WHERE id = ? AND status = 'out_of_stock'",
            [product.id]
          );
        }

        const intakeRef = note ? note.trim() : 'POS Floor Restock';
        const movementNote = `[POS Stock In] ${intakeRef}`;

        // Insert into stock_movements
        const [movResult] = await connection.query(
          `INSERT INTO stock_movements
             (branch_id, store_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, payment_method, note, performed_by, created_at)
           VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?, NULL, ?, ?, NOW())`,
          [
            targetBranch,
            store_id ? parseInt(store_id) : null,
            product.id,
            qty,
            curQty,
            newQty,
            costPrice,
            unitSellingPrice,
            movementNote,
            req.user.id
          ]
        );

        totalQuantity += qty;

        processedItems.push({
          movement_id: movResult.insertId,
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          quantity: qty,
          old_stock: curQty,
          new_stock: newQty,
          price_tier: 'cost',
          unit_price: costPrice,
          line_total: costPrice * qty
        });
      }
    }

    await connection.commit();
    connection.release();

    // Audit Log
    const auditAction = mode === 'stock_out' ? 'POS_SALE_TRANSACTION' : 'POS_STOCK_IN_TRANSACTION';
    await recordAuditLog(
      req.user.id,
      req.user.role,
      auditAction,
      'stock_movements',
      processedItems[0]?.movement_id || 0,
      { branch_id: targetBranch, mode, items_count: processedItems.length, total_quantity: totalQuantity },
      { grand_total: grandTotal, price_tier, payment_method },
      req
    );

    // Broadcast real-time Socket.io update so Super Admin and other screens sync live
    const io = req.app.get('io');
    if (io) {
      for (const item of processedItems) {
        io.emit('inventory_updated', {
          branch_id: targetBranch,
          item_id: item.product_id,
          new_qty: item.new_stock,
          action: mode === 'stock_out' ? 'pos_sale' : 'pos_restock'
        });
      }
      io.emit('stock_movement', {
        branch_id: targetBranch,
        action: mode,
        total_items: processedItems.length,
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: mode === 'stock_out'
        ? `Sale completed! ${totalQuantity} unit(s) stocked out. Total: RM ${grandTotal.toFixed(2)}.`
        : `Stock received! ${totalQuantity} unit(s) added to branch inventory.`,
      mode,
      branch_id: targetBranch,
      price_tier,
      payment_method,
      total_items: processedItems.length,
      total_quantity: totalQuantity,
      grand_total: grandTotal,
      items: processedItems,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('POS Transaction error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ─── POST /api/qr/scan-deduct (Legacy backward-compatibility) ─────────────────
router.post('/scan-deduct', authenticateToken, async (req, res) => {
  if (req.user.role === 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Super Admins cannot execute POS deductions.'
    });
  }

  req.body.mode = 'stock_out';
  req.body.price_tier = req.body.price_tier || 'customer';
  req.body.payment_method = 'qr';

  try {
    const { qr_code, quantity } = req.body;
    const targetBranch = req.user.branch_id ? parseInt(req.user.branch_id, 10) : null;
    if (!targetBranch) {
      return res.status(403).json({ success: false, message: 'You are not assigned to a branch.' });
    }

    const cleanCode = parseQrCode(qr_code);

    const [lookupRows] = await pool.query(
      `SELECT p.id, p.sku, p.name, COALESCE(pbs.quantity, 0) AS quantity
       FROM products p
       JOIN branches br ON br.id = ? AND p.business_id = br.business_id
       LEFT JOIN product_branch_stock pbs ON pbs.product_id = p.id AND pbs.branch_id = br.id
       WHERE (
         p.sku = ?
         OR ? LIKE CONCAT('%', p.sku)
         OR ? LIKE CONCAT('%-', p.sku)
         OR ? LIKE CONCAT('%', p.sku, '%')
         OR p.name = ?
         OR CAST(p.id AS CHAR) = ?
       )
       AND p.status != 'discontinued'
       ORDER BY (p.sku = ?) DESC, LENGTH(p.sku) DESC
       LIMIT 1`,
      [targetBranch, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode, cleanCode]
    );

    if (lookupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found for this branch.' });
    }

    const item = lookupRows[0];
    req.body.items = [{
      product_id: item.id,
      sku: item.sku,
      quantity: parseInt(quantity || 1, 10)
    }];

    // Execute pos-transaction logic directly
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [stocks] = await connection.query(
        'SELECT * FROM product_branch_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE',
        [item.id, targetBranch]
      );
      const curQty = stocks.length > 0 ? parseInt(stocks[0].quantity || 0) : 0;
      const qtyDeduct = parseInt(quantity || 1);

      if (curQty < qtyDeduct) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${curQty}, requested: ${qtyDeduct}` });
      }

      const newQty = curQty - qtyDeduct;
      await connection.query(
        'UPDATE product_branch_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?',
        [newQty, item.id, targetBranch]
      );

      if (newQty === 0) {
        await connection.query("UPDATE products SET status = 'out_of_stock' WHERE id = ?", [item.id]);
      }

      await connection.query(
        `INSERT INTO stock_movements
           (branch_id, item_id, movement_type, quantity, qty_before, qty_after, note, performed_by, created_at)
         VALUES (?, ?, 'out', ?, ?, ?, ?, ?, NOW())`,
        [targetBranch, item.id, qtyDeduct, curQty, newQty, `[QR Scan] ${req.body.note || 'Floor Sale'}`, req.user.id]
      );

      await connection.commit();
      connection.release();

      const io = req.app.get('io');
      if (io) {
        io.emit('inventory_updated', { branch_id: targetBranch, item_id: item.id, new_qty: newQty });
      }

      return res.json({
        success: true,
        message: `Stock deducted successfully! Product: ${item.sku} - ${item.name}. New balance: ${newQty}.`,
        item: { item_name: item.name, item_code: item.sku },
        qty_deducted: qtyDeduct,
        old_stock: curQty,
        new_stock: newQty
      });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
