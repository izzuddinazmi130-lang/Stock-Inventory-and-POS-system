const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');

// ─── Helpers ────────────────────────────────────────────────────────────────

const getEffectiveBranchId = (user, queryBranchId) => {
  if (user.role !== 'super_admin') {
    return user.branch_id || (queryBranchId ? parseInt(queryBranchId) : null);
  }
  if (queryBranchId) return parseInt(queryBranchId);
  return null;
};

// Generate a unique SKU for a branch + category combo
async function generateSku(branchCode, categoryPrefix, connection) {
  const db = connection || pool;
  const prefix = `${branchCode.toUpperCase()}-${categoryPrefix.toUpperCase().substring(0, 2)}`;
  // Find highest existing sequence for this prefix
  const [rows] = await db.query(
    `SELECT sku FROM products WHERE sku LIKE ? ORDER BY sku DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let seq = 1;
  if (rows.length > 0) {
    const lastCode = rows[0].sku;
    const lastNum = parseInt(lastCode.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) seq = lastNum + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// Generate unique QR token
function generateQrToken(branchCode, sku) {
  const ts = Date.now().toString(36).toUpperCase();
  return `HQ-${branchCode.toUpperCase()}-${sku}-${ts}`;
}

// ─── GET /api/products/variant-attributes ────────────────────────────────────
router.get('/variant-attributes', authenticateToken, async (req, res) => {
  try {
    const { business_id } = req.query;
    let query = 'SELECT * FROM product_variant_attributes';
    const params = [];
    if (business_id) { query += ' WHERE business_id = ?'; params.push(business_id); }
    query += ' ORDER BY sort_order ASC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, attributes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products ───────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req.user, req.query.branch_id);
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;
    const status = req.query.status ? req.query.status.trim() : null;

    let query = `
      SELECT 
        p.id, 
        p.sku, p.sku as item_code, 
        p.name, p.name as item_name, 
        p.category, p.description,
        p.price_customer, p.price_customer as selling_price, 
        p.price_dealer, p.price_staff, p.cost_price,
        p.min_quantity, p.min_quantity as minimum_quantity, 
        p.status, p.new_until,
        p.business_id, b2.name as business_name, b2.industry as business_type,
        pbs.branch_id, br.name as branch_name, br.branch_code, pbs.quantity
      FROM products p
      JOIN product_branch_stock pbs ON pbs.product_id = p.id
      JOIN branches br ON br.id = pbs.branch_id
      JOIN businesses b2 ON b2.id = p.business_id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.business_id) {
        query += ' AND p.business_id = ?';
        params.push(req.query.business_id);
    }
    if (branchId) { 
        query += ' AND pbs.branch_id = ?'; 
        params.push(branchId); 
    }
    if (status && status !== 'All' && status !== 'active') {
        query += ' AND p.status = ?';
        params.push(status);
    } else if (status === 'All') {
        // Return everything including discontinued
    } else {
        query += " AND p.status != 'discontinued'";
    }
    if (req.query.category && req.query.category !== 'All') {
        query += ' AND p.category = ?';
        params.push(req.query.category);
    }
    if (req.query.stock_status && req.query.stock_status !== 'all') {
        if (req.query.stock_status === 'out_of_stock') {
            query += ' AND (pbs.quantity = 0 OR p.status = "out_of_stock")';
        } else if (req.query.stock_status === 'low_stock') {
            query += ' AND pbs.quantity > 0 AND pbs.quantity <= p.min_quantity';
        } else if (req.query.stock_status === 'in_stock') {
            query += ' AND pbs.quantity > p.min_quantity';
        }
    }
    if (search) {
      query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)';
      params.push(search, search, search);
    }

    const sort = req.query.sort || 'date_desc';
    if (sort === 'name_asc') query += ' ORDER BY p.name ASC';
    else if (sort === 'name_desc') query += ' ORDER BY p.name DESC';
    else if (sort === 'sku_asc') query += ' ORDER BY p.sku ASC';
    else if (sort === 'qty_asc') query += ' ORDER BY pbs.quantity ASC';
    else if (sort === 'qty_desc') query += ' ORDER BY pbs.quantity DESC';
    else if (sort === 'date_asc') query += ' ORDER BY p.created_at ASC';
    else query += ' ORDER BY p.created_at DESC';
    const [rows] = await pool.query(query, params);

    // Load dynamic variant values
    const productIds = rows.map(r => r.id);
    const variantMap = {};
    if (productIds.length > 0) {
      const [variantRows] = await pool.query(
        `SELECT product_id, attribute_key, value FROM product_variant_values WHERE product_id IN (?)`,
        [productIds]
      );
      variantRows.forEach(v => {
        if (!variantMap[v.product_id]) variantMap[v.product_id] = {};
        variantMap[v.product_id][v.attribute_key] = v.value;
      });
    }

    rows.forEach(r => {
      r.name = r.name || r.item_name;
      r.sku = r.sku || r.item_code;
      r.item_name = r.name;
      r.item_code = r.sku;
      r.variants = variantMap[r.id] || {};
      r.colour = r.variants.colour || r.variants.color || null;
      r.variant_color = r.colour;
      r.size = r.variants.size || null;
      r.model = r.variants.model || null;
    });

    const stats = {
      totalItems: rows.length,
      totalStock: rows.reduce((s, r) => s + parseInt(r.quantity || 0), 0),
      lowStockCount: rows.filter(r => parseInt(r.quantity || 0) <= parseInt(r.minimum_quantity || 5)).length,
      newArrivals: rows.filter(r => r.new_until && new Date(r.new_until) > new Date()).length
    };

    return res.json({ success: true, items: rows, stats });
  } catch (err) {
    console.error('Fetch products error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory items: ' + err.message });
  }
});

// ─── GET /api/products/categories ───────────────────────────────────────────
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req.user, req.query.branch_id);
    let query = 'SELECT DISTINCT p.category FROM products p JOIN product_branch_stock pbs ON pbs.product_id = p.id WHERE p.category IS NOT NULL AND p.category != ""';
    const params = [];
    if (branchId) { query += ' AND pbs.branch_id = ?'; params.push(branchId); }
    query += ' ORDER BY p.category ASC';
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, categories: rows.map(r => r.category) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products/preview-sku ──────────────────────────────────────────
router.get('/preview-sku', authenticateToken, async (req, res) => {
  try {
    const { branch_id, category } = req.query;
    if (!branch_id || !category) {
      return res.status(400).json({ success: false, message: 'branch_id and category are required.' });
    }
    const [branches] = await pool.query('SELECT branch_code FROM branches WHERE id = ?', [branch_id]);
    if (branches.length === 0) return res.status(404).json({ success: false, message: 'Branch not found.' });

    const branchCode = branches[0].branch_code || `BR${branch_id}`;
    const catPrefix = category.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 2);
    const sku = await generateSku(branchCode, catPrefix);

    return res.json({ success: true, sku, qr_code: generateQrToken(branchCode, sku) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products/catalog ──────────────────────────────────────────────
// Returns all unique products across business catalog (used for Add Existing to Branch)
// For branch admins, excludes products already in their branch
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const { business_id } = req.query;
    let query = `
      SELECT 
        p.id, p.sku, p.name, p.category, p.status, p.business_id, b.name as business_name,
        p.price_customer, p.cost_price, p.min_quantity,
        COUNT(pbs.branch_id) as branch_count,
        COALESCE(SUM(pbs.quantity), 0) as total_stock
      FROM products p
      JOIN businesses b ON b.id = p.business_id
      LEFT JOIN product_branch_stock pbs ON pbs.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (business_id) {
      query += ' AND p.business_id = ?';
      params.push(business_id);
    }
    if (req.user.role !== 'super_admin' && req.user.business_id) {
      query += ' AND p.business_id = ?';
      params.push(req.user.business_id);
    }
    query += ' GROUP BY p.id ORDER BY p.name ASC';
    const [rows] = await pool.query(query, params);

    // For branch admins, filter out products that already exist in their branch
    let filteredRows = rows;
    if (req.user.role !== 'super_admin' && req.user.branch_id) {
      const userBranchId = parseInt(req.user.branch_id, 10);
      // Get product IDs that already exist in the user's branch
      const [existingStock] = await pool.query(
        'SELECT DISTINCT product_id FROM product_branch_stock WHERE branch_id = ?',
        [userBranchId]
      );
      const existingProductIds = new Set(existingStock.map(row => row.product_id));
      // Filter out products that are already in the user's branch
      filteredRows = rows.filter(row => !existingProductIds.has(row.id));
    }

    return res.json({ success: true, products: filteredRows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products/:id ───────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT 
        p.id, p.sku as item_code, p.name as item_name, p.category, p.description,
        p.price_customer as selling_price, p.price_dealer, p.price_staff, p.cost_price,
        p.min_quantity as minimum_quantity, p.status, p.new_until,
        p.business_id, b2.name as business_name, b2.industry as business_type,
        pbs.branch_id, br.name as branch_name, br.branch_code, pbs.quantity
      FROM products p
      JOIN product_branch_stock pbs ON pbs.product_id = p.id
      JOIN branches br ON br.id = pbs.branch_id
      JOIN businesses b2 ON b2.id = p.business_id
      WHERE p.id = ?`,
      [req.params.id]
    );
    if (items.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });

    const item = items[0];
    const effectiveBranch = getEffectiveBranchId(req.user, null);
    if (effectiveBranch && parseInt(item.branch_id) !== effectiveBranch) {
      return res.status(403).json({ success: false, message: 'Access denied: item belongs to another branch.' });
    }

    const [variantRows] = await pool.query(
      `SELECT attribute_key, value FROM product_variant_values WHERE product_id = ?`,
      [item.id]
    );
    item.variants = {};
    variantRows.forEach(v => {
      item.variants[v.attribute_key] = v.value;
    });
    item.colour = item.variants.colour || item.variants.color || null;
    item.variant_color = item.colour;
    item.size = item.variants.size || null;
    item.model = item.variants.model || null;

    return res.json({ success: true, item });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/products/add-to-branch ───────────────────────────────────────
// Stocks existing products in selected branches
router.post('/add-to-branch', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { product_ids, branch_ids, product_quantities, initial_quantity = 0 } = req.body;

    const pIds = (Array.isArray(product_ids) ? product_ids : [req.body.product_id]).filter(Boolean).map(id => parseInt(id, 10));
    let bIds = (Array.isArray(branch_ids) ? branch_ids : [req.body.branch_id]).filter(Boolean).map(id => parseInt(id, 10));

    // For branch admins, auto-select their branch if not provided
    if (req.user.role !== 'super_admin' && req.user.branch_id && bIds.length === 0) {
      bIds = [parseInt(req.user.branch_id, 10)];
    }

    if (pIds.length === 0 || bIds.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Please select at least one product and one branch.' });
    }

    // Permission check for non-super_admin
    if (req.user.role !== 'super_admin' && req.user.branch_id) {
      const hasOtherBranch = bIds.some(id => id !== parseInt(req.user.branch_id, 10));
      if (hasOtherBranch) {
        connection.release();
        return res.status(403).json({ success: false, message: 'You can only add products to your assigned branch.' });
      }
    }

    await connection.beginTransaction();

    let addedCount = 0;
    const addedPairs = [];

    for (const pId of pIds) {
      const [pRows] = await connection.query('SELECT * FROM products WHERE id = ?', [pId]);
      if (pRows.length === 0) continue;
      const product = pRows[0];
      const qtyForProduct = Math.max(0, parseInt(
        (product_quantities && (product_quantities[pId] ?? product_quantities[String(pId)])) ?? initial_quantity,
        10
      ) || 0);

      for (const bId of bIds) {
        const [bRows] = await connection.query('SELECT * FROM branches WHERE id = ?', [bId]);
        if (bRows.length === 0) continue;
        const branch = bRows[0];

        // Check if branch belongs to the product's business
        if (branch.business_id !== product.business_id) {
          continue;
        }

        const [existing] = await connection.query(
          'SELECT id FROM product_branch_stock WHERE product_id = ? AND branch_id = ?',
          [pId, bId]
        );

        if (existing.length === 0) {
          await connection.query(
            'INSERT INTO product_branch_stock (product_id, branch_id, quantity, created_at) VALUES (?, ?, ?, NOW())',
            [pId, bId, qtyForProduct]
          );

          if (qtyForProduct > 0) {
            await connection.query(
              `INSERT INTO stock_movements (branch_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
               VALUES (?, ?, 'in', ?, 0, ?, ?, ?, 'Stock Added to Branch', ?, NOW())`,
              [bId, pId, qtyForProduct, qtyForProduct, product.cost_price, product.price_customer, req.user.id]
            );
          }

          addedCount++;
          addedPairs.push({ product_id: pId, branch_id: bId });
        }
      }
    }

    await connection.commit();
    connection.release();

    await recordAuditLog(req.user.id, req.user.role, 'ADD_PRODUCT_TO_BRANCH', 'product_branch_stock', null, null, { products: pIds, branches: bIds, addedCount }, req);

    const io = req.app.get('io');
    if (io) {
      bIds.forEach(bid => io.emit('inventory_updated', { branch_id: bid, action: 'add_to_branch' }));
    }

    return res.json({
      success: true,
      message: `Successfully allocated ${addedCount} product-to-branch inventory record(s).`,
      added_count: addedCount
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Add to branch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add product to branch: ' + err.message });
  }
});

// ─── POST /api/products ──────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      item_name, category, description,
      quantity, minimum_quantity, min_quantity,
      unit_price, selling_price, price_dealer, price_staff, cost_price,
      variants, mark_as_new, new_duration_days,
      branch_id, branch_ids
    } = req.body;

    if (!item_name || !category) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Product name and category are required.' });
    }

    let targetBranchIds = [];
    if (req.user.role === 'super_admin' && Array.isArray(branch_ids) && branch_ids.length > 0) {
      targetBranchIds = branch_ids.map(id => parseInt(id));
    } else {
      const effectiveBranch = getEffectiveBranchId(req.user, branch_id) || 1;
      targetBranchIds = [effectiveBranch];
    }

    await connection.beginTransaction();
    const createdItems = [];

    // All branches must belong to the same business for a single product, get business_id from first branch
    const [firstBranch] = await connection.query('SELECT business_id, branch_code FROM branches WHERE id = ?', [targetBranchIds[0]]);
    if (firstBranch.length === 0) {
        await connection.rollback(); connection.release();
        return res.status(400).json({ success: false, message: 'Branch not found.' });
    }
    const businessId = firstBranch[0].business_id;
    const branchCode = firstBranch[0].branch_code || `BR${targetBranchIds[0]}`;
    const catPrefix = category.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 2);

    const sku = await generateSku(branchCode, catPrefix, connection);
    
    // Check SKU uniqueness
    const [dup] = await connection.query('SELECT id FROM products WHERE sku = ?', [sku]);
    if (dup.length > 0) {
      await connection.rollback(); connection.release();
      return res.status(400).json({ success: false, message: `SKU ${sku} already exists.` });
    }

    const minQty = parseInt(minimum_quantity || min_quantity) || 5;
    const initialQty = parseInt(quantity) || 0;
    const sPrice = parseFloat(selling_price) || 0.00;
    const dPrice = parseFloat(price_dealer) || 0.00;
    const stPrice = parseFloat(price_staff) || 0.00;
    const cPrice = parseFloat(cost_price || unit_price) || 0.00;
    const status = initialQty > 0 ? 'available' : 'out_of_stock';
    
    let newUntil = null;
    if (mark_as_new && new_duration_days) {
        const days = parseInt(new_duration_days);
        if (days > 0) {
            newUntil = new Date();
            newUntil.setDate(newUntil.getDate() + days);
        }
    }

    // Insert Product
    const [productResult] = await connection.query(
        `INSERT INTO products (business_id, sku, name, category, description, price_customer, price_dealer, price_staff, cost_price, min_quantity, status, new_until, created_by, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [businessId, sku, item_name.trim(), category.trim(), description || null, sPrice, dPrice, stPrice, cPrice, minQty, status, newUntil, req.user.id]
    );
    const productId = productResult.insertId;

    // Insert Variants
    if (variants && typeof variants === 'object') {
        for (const [key, value] of Object.entries(variants)) {
            if (value) {
                await connection.query(
                    'INSERT INTO product_variant_values (product_id, attribute_key, value) VALUES (?, ?, ?)',
                    [productId, key, value]
                );
            }
        }
    }

    // Insert Stock per Branch
    for (const targetBranch of targetBranchIds) {
        await connection.query(
            'INSERT INTO product_branch_stock (product_id, branch_id, quantity) VALUES (?, ?, ?)',
            [productId, targetBranch, initialQty]
        );

        if (initialQty > 0) {
            await connection.query(
                `INSERT INTO stock_movements (branch_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at) 
                 VALUES (?, ?, 'in', ?, 0, ?, ?, ?, 'Initial Inventory Addition', ?, NOW())`,
                [targetBranch, productId, initialQty, initialQty, cPrice, sPrice, req.user.id]
            );
        }
        
        const qrToken = generateQrToken(branchCode, sku);
        createdItems.push({ id: productId, sku, qr_code: qrToken, branch_id: targetBranch, branchCode });
    }

    await connection.commit();
    connection.release();

    const [createdRows] = await pool.query(
        `SELECT p.*, pbs.branch_id, br.name as branch_name 
         FROM products p 
         JOIN product_branch_stock pbs ON pbs.product_id = p.id 
         JOIN branches br ON br.id = pbs.branch_id 
         WHERE p.id = ?`,
        [productId]
    );

    await recordAuditLog(req.user.id, req.user.role, 'CREATE_ITEM', 'products', productId, null, { item_name, category, branches: targetBranchIds }, req);

    const io = req.app.get('io');
    if (io) {
      targetBranchIds.forEach(bid => io.emit('inventory_updated', { branch_id: bid, action: 'create' }));
    }

    return res.json({
      success: true,
      message: `Product '${item_name}' created in ${targetBranchIds.length} branch(es) successfully!`,
      item: createdRows[0] || null,
      created_items: createdItems,
      total_branches: targetBranchIds.length
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Create product error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create product: ' + err.message });
  }
});

// ─── PUT /api/products/:id ───────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const productId = req.params.id;
    const {
      item_name, category, description,
      min_quantity, minimum_quantity,
      selling_price, price_dealer, price_staff, cost_price, unit_price,
      status, variants
    } = req.body;

    if (req.body.sku || req.body.item_code) {
        connection.release();
        return res.status(400).json({ success: false, message: 'SKU cannot be modified after creation.' });
    }

    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [productId]);
    if (existing.length === 0) {
        await connection.rollback(); connection.release();
        return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const item = existing[0];
    const newMin = parseInt(minimum_quantity ?? min_quantity ?? item.min_quantity);
    const newStatus = status || item.status;

    await connection.query(
      `UPDATE products SET
         name = ?, category = ?, description = ?, min_quantity = ?,
         price_customer = ?, price_dealer = ?, price_staff = ?, cost_price = ?,
         status = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        item_name?.trim() || item.name,
        category?.trim() || item.category,
        description !== undefined ? description : item.description,
        newMin,
        selling_price !== undefined ? parseFloat(selling_price) : item.price_customer,
        price_dealer !== undefined ? parseFloat(price_dealer) : item.price_dealer,
        price_staff !== undefined ? parseFloat(price_staff) : item.price_staff,
        (cost_price || unit_price) !== undefined ? parseFloat(cost_price || unit_price) : item.cost_price,
        newStatus,
        productId
      ]
    );

    const effectiveVariants = variants && typeof variants === 'object' ? { ...variants } : {};
    if (req.body.variant_color || req.body.colour) effectiveVariants.colour = req.body.variant_color || req.body.colour;
    if (req.body.size) effectiveVariants.size = req.body.size;
    if (req.body.model) effectiveVariants.model = req.body.model;

    if (Object.keys(effectiveVariants).length > 0) {
        await connection.query('DELETE FROM product_variant_values WHERE product_id = ?', [productId]);
        for (const [key, value] of Object.entries(effectiveVariants)) {
            if (value) {
                await connection.query(
                    'INSERT INTO product_variant_values (product_id, attribute_key, value) VALUES (?, ?, ?)',
                    [productId, key, value]
                );
            }
        }
    }

    await connection.commit();
    connection.release();

    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_ITEM', 'products', productId, item, req.body, req);

    const [updated] = await pool.query(
      `SELECT p.*, p.sku as item_code, p.name as item_name, p.price_customer as selling_price, p.min_quantity as minimum_quantity 
       FROM products p WHERE p.id = ?`,
      [productId]
    );

    const io = req.app.get('io');
    if (io) io.emit('inventory_updated', { product_id: productId, action: 'update' });

    return res.json({ success: true, message: 'Product updated successfully!', item: updated[0] });
  } catch (err) {
    await connection.rollback();
    connection.release();
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/products/adjust-stock ────────────────────────────────────────
router.post('/adjust-stock', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { item_id, branch_id, adjustment_type, quantity, note, payment_method, store_id } = req.body;

    if (!item_id || !adjustment_type || !quantity || parseInt(quantity) <= 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Valid item, adjustment type, and quantity > 0 are required.' });
    }

    // Determine the branch to adjust
    const targetBranch = getEffectiveBranchId(req.user, branch_id);
    if (!targetBranch) {
        connection.release();
        return res.status(400).json({ success: false, message: 'Branch ID is required for stock adjustment.' });
    }

    const adjQty = parseInt(quantity);
    await connection.beginTransaction();

    const [products] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item_id]);
    if (products.length === 0) {
        await connection.rollback(); connection.release();
        return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const product = products[0];

    const [stocks] = await connection.query('SELECT * FROM product_branch_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE', [item_id, targetBranch]);
    if (stocks.length === 0) {
        await connection.rollback(); connection.release();
        return res.status(404).json({ success: false, message: 'Stock record not found for this branch.' });
    }
    
    const curQty = parseInt(stocks[0].quantity || 0);
    let newQty = curQty;
    let typeCode = 'in';

    if (adjustment_type === 'in') {
      newQty = curQty + adjQty;
      typeCode = 'in';
    } else if (adjustment_type === 'out') {
      if (curQty < adjQty) {
        await connection.rollback(); connection.release();
        return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${curQty}, requested: ${adjQty}` });
      }
      newQty = curQty - adjQty;
      typeCode = 'out';
    } else if (adjustment_type === 'adjust') {
      newQty = adjQty;
      typeCode = 'adjust';
    } else if (adjustment_type === 'damage') {
      if (curQty < adjQty) {
        await connection.rollback(); connection.release();
        return res.status(400).json({ success: false, message: `Insufficient stock for damage write-off. Available: ${curQty}, requested: ${adjQty}` });
      }
      newQty = curQty - adjQty;
      typeCode = 'damage';
    }

    await connection.query('UPDATE product_branch_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?', [newQty, item_id, targetBranch]);

    // Update product status globally if stock changes (as per requirements)
    if (newQty === 0 && product.status !== 'discontinued') {
        await connection.query('UPDATE products SET status = ? WHERE id = ?', ['out_of_stock', item_id]);
    } else if (newQty > 0 && product.status === 'out_of_stock') {
        await connection.query('UPDATE products SET status = ? WHERE id = ?', ['available', item_id]);
    }

    await connection.query(
      `INSERT INTO stock_movements
         (branch_id, store_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, payment_method, note, performed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [targetBranch, store_id || null, item_id, typeCode, adjQty, curQty, newQty, product.cost_price, product.price_customer, typeCode === 'out' ? (payment_method || 'cash') : null, note || `Stock ${adjustment_type.toUpperCase()} adjustment`, req.user.id]
    );

    await connection.commit();
    connection.release();

    await recordAuditLog(req.user.id, req.user.role, `STOCK_${adjustment_type.toUpperCase()}`, 'product_branch_stock', stocks[0].id, { old_qty: curQty }, { new_qty: newQty }, req);

    const io = req.app.get('io');
    if (io) io.emit('inventory_updated', { branch_id: targetBranch, item_id, new_qty: newQty });

    return res.json({ success: true, message: `Stock updated successfully! New balance: ${newQty} units.`, new_quantity: newQty });
  } catch (err) {
    await connection.rollback();
    connection.release();
    return res.status(500).json({ success: false, message: 'Stock adjustment failed: ' + err.message });
  }
});

// ─── DELETE /api/products/:id ────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }

    const [products] = await connection.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = products[0];

    // Find any matching legacy stock_items by item_code (SKU) or id
    const [legacyItems] = await connection.query(
      'SELECT id FROM stock_items WHERE item_code = ? OR id = ?',
      [product.sku, productId]
    );
    const relatedItemIds = [productId, ...legacyItems.map(r => r.id)];
    const uniqueItemIds = Array.from(new Set(relatedItemIds));

    // 1. Gather all evidence photo records from damage reports for this product so we can delete them from disk
    const [photos] = await connection.query(`
      SELECT drp.photo_path 
      FROM damage_report_photos drp
      JOIN damage_reports dr ON dr.id = drp.damage_report_id
      WHERE dr.product_id = ?
    `, [productId]);

    await connection.beginTransaction();

    // 2. Delete damage report photo records
    await connection.query(`
      DELETE drp FROM damage_report_photos drp
      JOIN damage_reports dr ON dr.id = drp.damage_report_id
      WHERE dr.product_id = ?
    `, [productId]);

    // 3. Delete damage reports
    await connection.query('DELETE FROM damage_reports WHERE product_id = ?', [productId]);

    // 4. Delete all stock movements recorded for this product or legacy stock items
    if (uniqueItemIds.length > 0) {
      await connection.query('DELETE FROM stock_movements WHERE item_id IN (?)', [uniqueItemIds]);
    }

    // 5. Delete legacy stock returns/damage records
    if (uniqueItemIds.length > 0) {
      await connection.query('DELETE FROM stock_returns_damage WHERE item_id IN (?)', [uniqueItemIds]).catch(() => {});
    }

    // 6. Delete branch stock balances
    await connection.query('DELETE FROM product_branch_stock WHERE product_id = ?', [productId]);

    // 7. Delete dynamic variant attribute values
    await connection.query('DELETE FROM product_variant_values WHERE product_id = ?', [productId]);

    // 8. Delete legacy stock_items
    await connection.query('DELETE FROM stock_items WHERE item_code = ? OR id = ?', [product.sku, productId]).catch(() => {});

    // 9. Clean up any prototype variant/master/qr tables matching SKU if they exist
    await connection.query('DELETE FROM qr_codes WHERE qr_code LIKE ?', [`%${product.sku}%`]).catch(() => {});
    await connection.query('DELETE FROM product_variants WHERE variant_sku = ?', [product.sku]).catch(() => {});
    await connection.query('DELETE FROM master_products WHERE sku = ?', [product.sku]).catch(() => {});

    // 10. Delete the master product row
    await connection.query('DELETE FROM products WHERE id = ?', [productId]);

    await connection.commit();
    connection.release();

    // 11. Delete all associated damage report photo files from disk
    for (const photo of photos) {
      if (photo.photo_path) {
        const relPath = photo.photo_path.replace(/^\/+/, '');
        const absPath = path.join(__dirname, '../../', relPath);
        if (fs.existsSync(absPath)) {
          try {
            fs.unlinkSync(absPath);
          } catch (unlinkErr) {
            console.warn(`[DeleteProduct] Could not unlink file ${absPath}:`, unlinkErr.message);
          }
        }
      }
    }

    // 12. Record audit log
    await recordAuditLog(
      req.user.id,
      req.user.role,
      'DELETE_ITEM',
      'products',
      productId,
      {
        sku: product.sku,
        name: product.name,
        category: product.category,
        business_id: product.business_id,
        purged_data: {
          damage_reports: true,
          damage_photos_count: photos.length,
          stock_movements: true,
          branch_stock: true,
          variant_values: true,
          legacy_stock_items: true
        }
      },
      null,
      req
    );

    // 13. Emit real-time WebSocket events
    const io = req.app.get('io');
    if (io) {
      io.emit('inventory_updated', { product_id: productId, deleted: true });
      io.emit('product_deleted', { product_id: productId, sku: product.sku });
    }

    return res.json({
      success: true,
      message: `Product '${product.name}' (${product.sku}) and all associated information (branch stock, movements, damage reports, and photos) were deleted successfully.`
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Delete product error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete product: ' + err.message });
  }
});

module.exports = router;
