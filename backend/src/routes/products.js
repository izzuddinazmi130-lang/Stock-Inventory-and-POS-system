const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');
const { resolveScope, handleScopeError } = require('../middleware/scope');
const { emitToBusiness } = require('../utils/realtime');

// ─── Helpers ─────────────────────────────────────────────────────────────────

// A branch admin may only act on products of their own business.
function assertProductInUserBusiness(user, product) {
  return user.role === 'super_admin' || parseInt(product.business_id, 10) === parseInt(user.business_id, 10);
}

// Canonical SKU format used by existing products and POS: BRANCH-CATEGORY###.
async function generateSku(branchCode, categoryPrefix, connection) {
  const db = connection || pool;
  const prefix = `${branchCode.toUpperCase()}-${categoryPrefix.toUpperCase().substring(0, 2)}`;
  const [rows] = await db.query(
    `SELECT sku FROM products WHERE sku LIKE ?`,
    [`${prefix}%`]
  );
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sequencePattern = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');
  const usedSequences = rows
    .map(row => String(row.sku || '').match(sequencePattern))
    .filter(Boolean)
    .map(match => Number(match[1]));
  let seq = usedSequences.length > 0 ? Math.max(...usedSequences) + 1 : 1;
  let candidate = `${prefix}${String(seq).padStart(3, '0')}`;

  while (true) {
    const [existing] = await db.query('SELECT id FROM products WHERE sku = ? LIMIT 1', [candidate]);
    if (existing.length === 0) return candidate;
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  }
}

// Generate unique QR token
function generateQrToken(branchCode, sku, productId = '') {
  return `HQ-${branchCode.toUpperCase()}-${sku}${productId ? `-${productId}` : ''}`;
}

// ─── GET /api/products/form-config ──────────────────────────────────────────
router.get('/form-config', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.role === 'super_admin'
      ? req.query.business_id
      : req.user.business_id;
    if (!businessId) return res.status(400).json({ success: false, message: 'business_id is required' });
    const [[categories], [attributes]] = await Promise.all([
      pool.query('SELECT * FROM business_form_categories WHERE business_id = ? ORDER BY sort_order, name', [businessId]),
      pool.query('SELECT * FROM business_form_fields WHERE business_id = ? ORDER BY sort_order, label', [businessId])
    ]);
    res.json({ success: true, categories, attributes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products/variant-attributes (legacy compatibility) ────────────
router.get('/variant-attributes', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.role === 'super_admin'
      ? (req.query.business_id || req.user.business_id)
      : req.user.business_id;
    if (!businessId) return res.status(400).json({ success: false, message: 'business_id is required' });
    const [rows] = await pool.query('SELECT * FROM business_form_fields WHERE business_id = ? ORDER BY sort_order, label', [businessId]);
    res.json({ success: true, attributes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products ───────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
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
        pbs.branch_id, br.name as branch_name, br.branch_code, pbs.quantity,
        (SELECT COUNT(*) FROM product_branch_stock s2 WHERE s2.product_id = p.id) AS branch_count
      FROM products p
      JOIN product_branch_stock pbs ON pbs.product_id = p.id
      JOIN branches br ON br.id = pbs.branch_id
      JOIN businesses b2 ON b2.id = p.business_id
      WHERE 1=1
    `;
    const params = [];

    if (businessId) {
        query += ' AND p.business_id = ?';
        params.push(businessId);
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
            query += ' AND pbs.quantity <= 0';
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
      // Stock level for THIS branch row, derived from quantity (never from products.status)
      const qty = parseInt(r.quantity || 0, 10);
      r.stock_status = qty <= 0 ? 'out' : qty <= parseInt(r.minimum_quantity || 0, 10) ? 'low' : 'ok';
    });

    const stats = {
      totalItems: rows.length,
      totalStock: rows.reduce((s, r) => s + parseInt(r.quantity || 0), 0),
      lowStockCount: rows.filter(r => r.stock_status !== 'ok').length,
      newArrivals: rows.filter(r => r.new_until && new Date(r.new_until) > new Date()).length
    };

    return res.json({ success: true, items: rows, stats });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    console.error('Fetch products error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory items: ' + err.message });
  }
});

// ─── GET /api/products/categories ───────────────────────────────────────────
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
    let query = 'SELECT DISTINCT p.category FROM products p JOIN product_branch_stock pbs ON pbs.product_id = p.id WHERE p.category IS NOT NULL AND p.category != ""';
    const params = [];
    if (businessId) { query += ' AND p.business_id = ?'; params.push(businessId); }
    if (branchId) { query += ' AND pbs.branch_id = ?'; params.push(branchId); }
    query += ' ORDER BY p.category ASC';
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, categories: rows.map(r => r.category) });
  } catch (err) {
    if (handleScopeError(res, err)) return;
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
    if (req.user.role !== 'super_admin' && parseInt(branch_id, 10) !== parseInt(req.user.branch_id, 10)) {
      return res.status(403).json({ success: false, message: 'Access denied: not your branch.' });
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
// Business catalog used by "Add to branch / Restock". Products already in the target branch are
// NOT hidden: each row carries in_branch / branch_qty for that branch so the UI can offer a restock.
// Target branch: admin → their own branch; super_admin → optional ?branch_id.
// total_stock (summed across all branches) is returned to super_admin only.
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
    const isSuperAdmin = req.user.role === 'super_admin';

    let query = `
      SELECT
        p.id, p.sku, p.name, p.category, p.status, p.business_id, b.name as business_name,
        p.price_customer, p.cost_price, p.min_quantity,
        (tb.product_id IS NOT NULL) AS in_branch,
        tb.quantity AS branch_qty
        ${isSuperAdmin ? ', (SELECT COUNT(*) FROM product_branch_stock s WHERE s.product_id = p.id) AS branch_count' : ''}
        ${isSuperAdmin ? ', (SELECT COALESCE(SUM(s.quantity), 0) FROM product_branch_stock s WHERE s.product_id = p.id) AS total_stock' : ''}
      FROM products p
      JOIN businesses b ON b.id = p.business_id
      LEFT JOIN product_branch_stock tb ON tb.product_id = p.id AND tb.branch_id = ?
      WHERE p.status != 'discontinued'
    `;
    const params = [branchId || 0];
    if (businessId) {
      query += ' AND p.business_id = ?';
      params.push(businessId);
    }
    query += ' ORDER BY p.name ASC';
    const [rows] = await pool.query(query, params);

    rows.forEach(r => {
      r.in_branch = Boolean(r.in_branch);
      r.branch_qty = r.in_branch ? parseInt(r.branch_qty || 0, 10) : null;
      if (isSuperAdmin) r.total_stock = Number(r.total_stock) || 0;
    });

    return res.json({ success: true, branch_id: branchId, products: rows });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products/low-stock ────────────────────────────────────────────
// Branch stock rows at or below the product's "alert at" level (quantity 0 = out of stock).
// Branch admin: own branch. Super admin: optional ?business_id / ?branch_id.
// ?limit=N returns only the N most urgent rows (counts always cover everything).
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });
    const limit = parseInt(req.query.limit, 10) || null;

    let query = `
      SELECT p.id, p.sku, p.name, p.category, p.min_quantity, p.price_customer,
             p.business_id, b.name AS business_name,
             pbs.branch_id, br.name AS branch_name, pbs.quantity
      FROM product_branch_stock pbs
      JOIN products p ON p.id = pbs.product_id
      JOIN branches br ON br.id = pbs.branch_id
      JOIN businesses b ON b.id = p.business_id
      WHERE p.status != 'discontinued' AND pbs.quantity <= p.min_quantity
    `;
    const params = [];
    if (businessId) { query += ' AND p.business_id = ?'; params.push(businessId); }
    if (branchId) { query += ' AND pbs.branch_id = ?'; params.push(branchId); }
    query += ' ORDER BY (pbs.quantity <= 0) DESC, (pbs.quantity - p.min_quantity) ASC, p.name ASC';
    const [rows] = await pool.query(query, params);

    const ids = [...new Set(rows.map(r => r.id))];
    const variantMap = {};
    if (ids.length > 0) {
      const [variantRows] = await pool.query('SELECT product_id, attribute_key, value FROM product_variant_values WHERE product_id IN (?)', [ids]);
      variantRows.forEach(v => { (variantMap[v.product_id] = variantMap[v.product_id] || {})[v.attribute_key] = v.value; });
    }

    const items = rows.map(r => {
      const quantity = parseInt(r.quantity, 10) || 0;
      const min = parseInt(r.min_quantity, 10) || 0;
      return {
        ...r,
        quantity,
        min_quantity: min,
        variants: variantMap[r.id] || {},
        size: variantMap[r.id]?.size || null,
        stock_status: quantity <= 0 ? 'out' : 'low',
        // Enough to get back to twice the alert level
        suggested_restock: Math.max(1, min * 2 - quantity)
      };
    });

    const counts = {
      out: items.filter(i => i.stock_status === 'out').length,
      low: items.filter(i => i.stock_status === 'low').length
    };
    counts.total = counts.out + counts.low;

    return res.json({ success: true, counts, items: limit ? items.slice(0, limit) : items });
  } catch (err) {
    if (handleScopeError(res, err)) return;
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/products/:id ───────────────────────────────────────────────────
// Returns the product row for the caller's branch (admin) or the requested/first branch (super_admin).
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { businessId, branchId } = await resolveScope(req, { level: 'branch' });

    let query = `SELECT
        p.id, p.sku as item_code, p.name as item_name, p.category, p.description,
        p.price_customer as selling_price, p.price_dealer, p.price_staff, p.cost_price,
        p.min_quantity as minimum_quantity, p.status, p.new_until,
        p.business_id, b2.name as business_name, b2.industry as business_type,
        pbs.branch_id, br.name as branch_name, br.branch_code, pbs.quantity,
        (SELECT COUNT(*) FROM product_branch_stock s2 WHERE s2.product_id = p.id) AS branch_count
      FROM products p
      JOIN product_branch_stock pbs ON pbs.product_id = p.id
      JOIN branches br ON br.id = pbs.branch_id
      JOIN businesses b2 ON b2.id = p.business_id
      WHERE p.id = ?`;
    const params = [req.params.id];
    if (businessId) { query += ' AND p.business_id = ?'; params.push(businessId); }
    if (branchId) { query += ' AND pbs.branch_id = ?'; params.push(branchId); }
    query += ' ORDER BY pbs.branch_id LIMIT 1';

    const [items] = await pool.query(query, params);
    if (items.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });

    const item = items[0];

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
    if (handleScopeError(res, err)) return;
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/products/add-to-branch ───────────────────────────────────────
// Upsert: adds existing catalog products to branches, or restocks them if already there.
// Body: { product_ids[], branch_ids[], product_quantities: { [productId]: qty }, initial_quantity? }
// qty must be an integer >= 1 to restock; 0 is allowed only to list a product in a branch without stock.
// Returns results[] = { product_id, branch_id, action: 'created'|'restocked'|'skipped', reason?, qty_before, qty_after }.
router.post('/add-to-branch', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { product_ids, branch_ids, product_quantities, initial_quantity = 1 } = req.body;

    const pIds = [...new Set((Array.isArray(product_ids) ? product_ids : [req.body.product_id]).filter(Boolean).map(id => parseInt(id, 10)))];
    let bIds = [...new Set((Array.isArray(branch_ids) ? branch_ids : [req.body.branch_id]).filter(Boolean).map(id => parseInt(id, 10)))];

    if (req.user.role !== 'super_admin') {
      // Branch admin: business and branch always come from the token
      const { branchId } = await resolveScope(req, { level: 'branch' });
      if (bIds.some(id => id !== branchId)) {
        return res.status(403).json({ success: false, message: 'You can only add products to your assigned branch.' });
      }
      bIds = [branchId];
    }

    if (pIds.length === 0 || bIds.length === 0 || pIds.some(isNaN) || bIds.some(isNaN)) {
      return res.status(400).json({ success: false, message: 'Please select at least one product and one branch.' });
    }

    const [productRows] = await pool.query('SELECT id, name, sku, business_id, status, cost_price, price_customer FROM products WHERE id IN (?)', [pIds]);
    const [branchRows] = await pool.query('SELECT id, name, business_id FROM branches WHERE id IN (?)', [bIds]);
    const productMap = new Map(productRows.map(p => [p.id, p]));
    const branchMap = new Map(branchRows.map(b => [b.id, b]));

    if (req.user.role !== 'super_admin') {
      const foreign = productRows.filter(p => !assertProductInUserBusiness(req.user, p));
      if (foreign.length > 0) {
        return res.status(403).json({ success: false, message: 'Access denied: one or more products belong to another business.' });
      }
    }

    const rawQtyFor = (pId) => {
      const perProduct = product_quantities && (product_quantities[pId] ?? product_quantities[String(pId)]);
      return perProduct ?? initial_quantity;
    };

    const results = [];
    const skip = (product_id, branch_id, reason, qty_before = null) =>
      results.push({ product_id, branch_id, action: 'skipped', reason, qty_before, qty_after: qty_before });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const pId of pIds) {
      const product = productMap.get(pId);
      const rawQty = rawQtyFor(pId);
      const qty = Number(rawQty);
      const qtyValid = rawQty !== '' && rawQty !== null && Number.isInteger(qty) && qty >= 0;

      for (const bId of bIds) {
        const branch = branchMap.get(bId);
        if (!product) { skip(pId, bId, 'product not found'); continue; }
        if (product.status === 'discontinued') { skip(pId, bId, 'product is discontinued'); continue; }
        if (!branch) { skip(pId, bId, 'branch not found'); continue; }
        if (branch.business_id !== product.business_id) { skip(pId, bId, 'different business'); continue; }
        if (!qtyValid) { skip(pId, bId, 'invalid quantity (must be a whole number, 0 or more)'); continue; }

        const [existing] = await connection.query(
          'SELECT id, quantity FROM product_branch_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE',
          [pId, bId]
        );

        if (existing.length === 0) {
          await connection.query(
            'INSERT INTO product_branch_stock (product_id, branch_id, quantity, created_at) VALUES (?, ?, ?, NOW())',
            [pId, bId, qty]
          );
          if (qty > 0) {
            await connection.query(
              `INSERT INTO stock_movements (branch_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
               VALUES (?, ?, 'in', ?, 0, ?, ?, ?, 'Stock Added to Branch', ?, NOW())`,
              [bId, pId, qty, qty, product.cost_price, product.price_customer, req.user.id]
            );
          }
          results.push({ product_id: pId, branch_id: bId, action: 'created', qty_before: 0, qty_after: qty });
        } else {
          const qtyBefore = parseInt(existing[0].quantity || 0, 10);
          if (qty < 1) { skip(pId, bId, 'already in branch; restock quantity must be at least 1', qtyBefore); continue; }
          const qtyAfter = qtyBefore + qty;
          await connection.query('UPDATE product_branch_stock SET quantity = ? WHERE id = ?', [qtyAfter, existing[0].id]);
          await connection.query(
            `INSERT INTO stock_movements (branch_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
             VALUES (?, ?, 'in', ?, ?, ?, ?, ?, 'Restock', ?, NOW())`,
            [bId, pId, qty, qtyBefore, qtyAfter, product.cost_price, product.price_customer, req.user.id]
          );
          results.push({ product_id: pId, branch_id: bId, action: 'restocked', qty_before: qtyBefore, qty_after: qtyAfter });
        }

        // Stock is back above zero → product is no longer out of stock
      }
    }

    await connection.commit();
    connection.release();
    connection = null;

    const created = results.filter(r => r.action === 'created');
    const restocked = results.filter(r => r.action === 'restocked');
    const skipped = results.filter(r => r.action === 'skipped');

    // e.g. "2 added, 1 restocked, 1 skipped: different business"
    const parts = [];
    if (created.length) parts.push(`${created.length} added`);
    if (restocked.length) parts.push(`${restocked.length} restocked`);
    if (skipped.length) {
      const reasons = [...new Set(skipped.map(r => r.reason))].join('; ');
      parts.push(`${skipped.length} skipped: ${reasons}`);
    }
    const message = parts.join(', ') || 'Nothing to do.';

    await recordAuditLog(req.user.id, req.user.role, 'ADD_PRODUCT_TO_BRANCH', 'product_branch_stock', null, null, { products: pIds, branches: bIds, results }, req);

    // Notify only the branches that actually changed
    const changed = [...created, ...restocked];
    const affectedBranchIds = [...new Set(changed.map(r => r.branch_id))];
    affectedBranchIds.forEach(bid => {
      emitToBusiness(req, branchMap.get(bid).business_id, 'inventory_updated', { branch_id: bid, action: 'add_to_branch' });
    });

    return res.json({
      success: changed.length > 0,
      partial: changed.length > 0 && skipped.length > 0,
      message,
      results,
      added_count: created.length,
      restocked_count: restocked.length,
      skipped_count: skipped.length
    });

  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    if (handleScopeError(res, err)) return;
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
      branch_id, branch_ids, size_variants
    } = req.body;

    if (!item_name || !category) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Product name and category are required.' });
    }

    let targetBranchIds = [];
    if (req.user.role !== 'super_admin') {
      // Branch admin: always their own branch
      const { branchId } = await resolveScope(req, { level: 'branch' });
      targetBranchIds = [branchId];
    } else if (Array.isArray(branch_ids) && branch_ids.length > 0) {
      targetBranchIds = [...new Set(branch_ids.map(id => parseInt(id, 10)))];
    } else if (branch_id) {
      targetBranchIds = [parseInt(branch_id, 10)];
    }
    if (targetBranchIds.length === 0 || targetBranchIds.some(isNaN)) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Please select at least one branch.' });
    }

    // A product belongs to exactly one business, so every target branch must share it
    const [targetBranches] = await connection.query('SELECT DISTINCT business_id FROM branches WHERE id IN (?)', [targetBranchIds]);
    if (targetBranches.length > 1) {
      connection.release();
      return res.status(400).json({ success: false, message: 'All selected branches must belong to the same business.' });
    }

    await connection.beginTransaction();
    const createdItems = [];
    const createdProducts = [];
    const createdProductIds = [];
    const sizeRows = Array.isArray(size_variants) && size_variants.length > 0
      ? size_variants.filter(row => row && String(row.size || '').trim())
      : [null];

    // All branches must belong to the same business for a single product, get business_id from first branch
    const [firstBranch] = await connection.query('SELECT business_id, branch_code FROM branches WHERE id = ?', [targetBranchIds[0]]);
    if (firstBranch.length === 0) {
        await connection.rollback(); connection.release();
        return res.status(400).json({ success: false, message: 'Branch not found.' });
    }
    const businessId = firstBranch[0].business_id;
    const branchCode = firstBranch[0].branch_code || `BR${targetBranchIds[0]}`;
    const catPrefix = category.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 2);

    let newUntil = null;
    if (mark_as_new && new_duration_days) {
        const days = parseInt(new_duration_days);
        if (days > 0) {
            newUntil = new Date();
            newUntil.setDate(newUntil.getDate() + days);
        }
    }

    for (const sizeRow of sizeRows) {
      const sku = await generateSku(branchCode, catPrefix, connection);
      const rowValue = (value, fallback) => value === undefined || value === '' ? fallback : value;
      const minQty = parseInt(rowValue(sizeRow?.minimum_quantity, minimum_quantity ?? min_quantity ?? 5), 10) || 0;
      const initialQty = parseInt(rowValue(sizeRow?.quantity, quantity), 10) || 0;
      const sPrice = parseFloat(rowValue(sizeRow?.selling_price, selling_price)) || 0.00;
      const dPrice = parseFloat(rowValue(sizeRow?.price_dealer, price_dealer)) || 0.00;
      const stPrice = parseFloat(rowValue(sizeRow?.price_staff, price_staff)) || 0.00;
      const cPrice = parseFloat(rowValue(sizeRow?.unit_price, cost_price || unit_price)) || 0.00;
      // Stock level is per branch and derived from quantity; status only says whether the product is sold at all
      const status = 'available';
      const productVariants = { ...(variants && typeof variants === 'object' ? variants : {}) };
      if (sizeRow?.size) productVariants.size = String(sizeRow.size).trim();

      const [productResult] = await connection.query(
        `INSERT INTO products (business_id, sku, name, category, description, price_customer, price_dealer, price_staff, cost_price, min_quantity, status, new_until, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [businessId, sku, item_name.trim(), category.trim(), description || null, sPrice, dPrice, stPrice, cPrice, minQty, status, newUntil, req.user.id]
      );
      const productId = productResult.insertId;
      createdProductIds.push(productId);

      for (const [key, value] of Object.entries(productVariants)) {
        if (value) {
          await connection.query(
            'INSERT INTO product_variant_values (product_id, attribute_key, value) VALUES (?, ?, ?)',
            [productId, key, value]
          );
        }
      }

      let qrToken = '';
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

          qrToken = generateQrToken(branchCode, sku, productId);
        createdItems.push({ id: productId, sku, qr_code: qrToken, branch_id: targetBranch, branchCode });
      }
      const qrSvg = await QRCode.toString(qrToken, { type: 'svg', margin: 1, width: 180 });
      createdProducts.push({ id: productId, sku, item_code: sku, item_name: item_name.trim(), qr_code: qrToken, qr_svg: qrSvg, size: productVariants.size || null, variants: productVariants, quantity: initialQty, minimum_quantity: minQty, selling_price: sPrice, price_dealer: dPrice, price_staff: stPrice, unit_price: cPrice });
    }

    await connection.commit();
    connection.release();

    const [createdRows] = await pool.query(
        `SELECT p.*, pbs.branch_id, br.name as branch_name 
         FROM products p 
         JOIN product_branch_stock pbs ON pbs.product_id = p.id 
         JOIN branches br ON br.id = pbs.branch_id 
       WHERE p.id IN (?)`,
      [createdProductIds]
    );

    await recordAuditLog(req.user.id, req.user.role, 'CREATE_ITEM', 'products', createdProductIds[0], null, { item_name, category, sizes: sizeRows.map(row => row?.size).filter(Boolean), branches: targetBranchIds }, req);

    targetBranchIds.forEach(bid => emitToBusiness(req, businessId, 'inventory_updated', { branch_id: bid, action: 'create' }));

    return res.json({
      success: true,
      message: `${createdProductIds.length} product size(s) created in ${targetBranchIds.length} branch(es) successfully!`,
      item: createdRows[0] || null,
      products: createdProducts,
      created_items: createdItems,
      total_products: createdProductIds.length,
      total_branches: targetBranchIds.length
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    if (handleScopeError(res, err)) return;
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

    // Branch admin: product must belong to their business and be stocked in their branch
    if (req.user.role !== 'super_admin') {
      const { branchId } = await resolveScope(req, { level: 'branch' });
      const [inBranch] = await connection.query('SELECT id FROM product_branch_stock WHERE product_id = ? AND branch_id = ?', [productId, branchId]);
      if (!assertProductInUserBusiness(req.user, item) || inBranch.length === 0) {
        await connection.rollback(); connection.release();
        return res.status(403).json({ success: false, message: 'Access denied: this product is not in your branch.' });
      }
    }

    const newMin = parseInt(minimum_quantity ?? min_quantity ?? item.min_quantity);
    // 'out_of_stock' is no longer a stored status (it is derived from each branch's quantity)
    const newStatus = status === 'discontinued' ? 'discontinued' : (status ? 'available' : (item.status === 'discontinued' ? 'discontinued' : 'available'));

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

    emitToBusiness(req, item.business_id, 'inventory_updated', { product_id: productId, action: 'update' });

    return res.json({ success: true, message: 'Product updated successfully!', item: updated[0] });
  } catch (err) {
    await connection.rollback();
    connection.release();
    if (handleScopeError(res, err)) return;
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

    // Determine the branch to adjust: admin → own branch; super_admin → body branch_id
    const targetBranch = req.user.role === 'super_admin'
      ? (parseInt(branch_id, 10) || null)
      : (await resolveScope(req, { level: 'branch' })).branchId;
    if (!targetBranch) {
        connection.release();
        return res.status(400).json({ success: false, message: 'Branch ID is required for stock adjustment.' });
    }
    if (store_id) {
      const [storeRows] = await connection.query(
        `SELECT id, name, (status = 'ended' OR (end_date IS NOT NULL AND end_date < NOW())) AS is_over
         FROM stores WHERE id = ? AND branch_id = ?`, [store_id, targetBranch]);
      if (storeRows.length === 0) {
        connection.release();
        return res.status(403).json({ success: false, message: 'That store does not belong to this branch.' });
      }
      if (adjustment_type === 'out' && Number(storeRows[0].is_over)) {
        connection.release();
        return res.status(400).json({ success: false, code: 'STORE_ENDED', message: `${storeRows[0].name} has ended, so stock can no longer be sold there.` });
      }
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

    await connection.query(
      `INSERT INTO stock_movements
         (branch_id, store_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, payment_method, note, performed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [targetBranch, store_id || null, item_id, typeCode, adjQty, curQty, newQty, product.cost_price, product.price_customer, typeCode === 'out' ? (payment_method || 'cash') : null, note || `Stock ${adjustment_type.toUpperCase()} adjustment`, req.user.id]
    );

    await connection.commit();
    connection.release();

    await recordAuditLog(req.user.id, req.user.role, `STOCK_${adjustment_type.toUpperCase()}`, 'product_branch_stock', stocks[0].id, { old_qty: curQty }, { new_qty: newQty }, req);

    emitToBusiness(req, product.business_id, 'inventory_updated', { branch_id: targetBranch, item_id, new_qty: newQty });

    return res.json({ success: true, message: `Stock updated successfully! New balance: ${newQty} units.`, new_quantity: newQty });
  } catch (err) {
    await connection.rollback();
    connection.release();
    if (handleScopeError(res, err)) return;
    return res.status(500).json({ success: false, message: 'Stock adjustment failed: ' + err.message });
  }
});

// ─── DELETE /api/products/:id ────────────────────────────────────────────────
// ─── DELETE /api/products/:id/branches/:branchId ─────────────────────────────
// Take a product out of ONE branch; it stays (with its stock) in every other branch.
//  - Branch admin: own branch only. Super admin: any branch.
//  - Not allowed for the last branch that stocks it (use DELETE /:id to remove the product completely).
//  - Units still held at that branch are written off with an 'adjust' movement so reports stay correct.
//  - Sales, past movements and damage reports for that branch are kept.
router.delete('/:id/branches/:branchId', authenticateToken, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const branchId = parseInt(req.params.branchId, 10);
  if (isNaN(productId) || isNaN(branchId)) {
    return res.status(400).json({ success: false, message: 'Invalid product or branch.' });
  }
  const connection = await pool.getConnection();
  try {
    const [products] = await connection.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (!products.length) return res.status(404).json({ success: false, message: 'Product not found.' });
    const product = products[0];

    if (req.user.role !== 'super_admin') {
      const scope = await resolveScope(req, { level: 'branch' });
      if (scope.branchId !== branchId || !assertProductInUserBusiness(req.user, product)) {
        return res.status(403).json({ success: false, message: 'You can only remove products from your own branch.' });
      }
    }

    const [[branch]] = await connection.query('SELECT id, name FROM branches WHERE id = ?', [branchId]);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });

    await connection.beginTransaction();
    const [stockRows] = await connection.query('SELECT branch_id, quantity FROM product_branch_stock WHERE product_id = ? FOR UPDATE', [productId]);
    const here = stockRows.find(r => r.branch_id === branchId);
    if (!here) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: `This product is not stocked at ${branch.name}.` });
    }
    if (stockRows.length === 1) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        code: 'ONLY_BRANCH',
        message: `${branch.name} is the only branch that stocks this product. Use “Delete product” to remove it completely.`,
      });
    }

    const qty = parseInt(here.quantity, 10) || 0;
    if (qty !== 0) {
      await connection.query(
        `INSERT INTO stock_movements (branch_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
         VALUES (?, ?, 'adjust', ?, ?, 0, ?, ?, ?, ?, NOW())`,
        [branchId, productId, Math.abs(qty), qty, product.cost_price || 0, product.price_customer || 0, `Removed from branch ${branch.name}`, req.user.id]
      );
    }
    await connection.query('DELETE FROM product_branch_stock WHERE product_id = ? AND branch_id = ?', [productId, branchId]);
    await connection.commit();

    await recordAuditLog(req.user.id, req.user.role, 'REMOVE_PRODUCT_FROM_BRANCH', 'product_branch_stock', productId,
      { branch_id: branchId, branch_name: branch.name, quantity: qty },
      { sku: product.sku, name: product.name, remaining_branches: stockRows.length - 1 }, req);
    emitToBusiness(req, product.business_id, 'inventory_updated', { product_id: productId, branch_id: branchId, action: 'remove_from_branch' });

    const left = stockRows.length - 1;
    return res.json({
      success: true,
      message: `${product.name} was removed from ${branch.name}. It is still stocked in ${left} other branch${left === 1 ? '' : 'es'}.`,
      written_off: qty,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    if (handleScopeError(res, err)) return;
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

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

    // Branch admin: deletion purges the product from EVERY branch, so it is only allowed when the
    // product belongs to their business and is stocked in no branch other than their own.
    if (req.user.role !== 'super_admin') {
      const { branchId } = await resolveScope(req, { level: 'branch' });
      const [stockBranches] = await connection.query('SELECT branch_id FROM product_branch_stock WHERE product_id = ?', [productId]);
      const inOwnBranch = stockBranches.some(r => r.branch_id === branchId);
      const inOtherBranch = stockBranches.some(r => r.branch_id !== branchId);
      if (!assertProductInUserBusiness(req.user, product) || !inOwnBranch) {
        connection.release();
        return res.status(403).json({ success: false, message: 'Access denied: this product is not in your branch.' });
      }
      if (inOtherBranch) {
        connection.release();
        return res.status(403).json({ success: false, message: 'This product is also stocked in other branches. Use “Remove from this branch” to take it out of your branch only; deleting it everywhere needs a Super Admin.' });
      }
    }

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

    // 4. Delete all stock movements recorded for this product
    await connection.query('DELETE FROM stock_movements WHERE item_id = ?', [productId]);

    // 5. Delete branch stock balances
    await connection.query('DELETE FROM product_branch_stock WHERE product_id = ?', [productId]);

    // 6. Delete dynamic variant attribute values
    await connection.query('DELETE FROM product_variant_values WHERE product_id = ?', [productId]);

    // 7. Clean up any prototype variant/master/qr tables matching SKU if they exist
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
          variant_values: true
        }
      },
      null,
      req
    );

    // 13. Emit real-time WebSocket events
    emitToBusiness(req, product.business_id, 'inventory_updated', { product_id: productId, deleted: true });
    emitToBusiness(req, product.business_id, 'product_deleted', { product_id: productId, sku: product.sku });

    return res.json({
      success: true,
      message: `Product '${product.name}' (${product.sku}) and all associated information (branch stock, movements, damage reports, and photos) were deleted successfully.`
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    if (handleScopeError(res, err)) return;
    console.error('Delete product error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete product: ' + err.message });
  }
});

module.exports = router;
