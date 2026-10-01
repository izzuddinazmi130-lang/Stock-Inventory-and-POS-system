const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');
const { emitToBusiness } = require('../utils/realtime');

const parseOptions = (options) => {
  if (Array.isArray(options)) return options.map(String).map(v => v.trim()).filter(Boolean);
  if (typeof options === 'string') {
    try { return parseOptions(JSON.parse(options)); } catch (_) { return options.split(',').map(v => v.trim()).filter(Boolean); }
  }
  return [];
};

const getBusiness = async (businessId) => {
  const [rows] = await pool.query('SELECT id FROM businesses WHERE id = ?', [businessId]);
  return rows[0];
};

const validateBusinessId = async (req, res, next) => {
  if (!(await getBusiness(req.params.id))) return res.status(404).json({ success: false, message: 'Business not found' });
  next();
};

// GET / - list businesses. super_admin: all. admin: their own business only.
router.get('/', authenticateToken, async (req, res) => {
  try {
    let businesses;
    if (req.user.role === 'super_admin') {
      [businesses] = await pool.query(`
        SELECT 
          b.*,
          (SELECT COUNT(*) FROM branches br WHERE br.business_id = b.id AND br.is_active = 1) AS active_branch_count,
          (SELECT COUNT(*) FROM branches br WHERE br.business_id = b.id) AS total_branch_count
        FROM businesses b
        ORDER BY b.name ASC
      `);
    } else {
      if (!req.user.business_id) {
        return res.status(403).json({ success: false, message: 'Access denied: your account is not assigned to a business.' });
      }
      [businesses] = await pool.query(`
        SELECT 
          b.*,
          (SELECT COUNT(*) FROM branches br WHERE br.business_id = b.id AND br.is_active = 1) AS active_branch_count,
          (SELECT COUNT(*) FROM branches br WHERE br.business_id = b.id) AS total_branch_count
        FROM businesses b
        WHERE b.id = ?
      `, [req.user.business_id]);
    }
    return res.json({ success: true, data: businesses, businesses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// POST / - create business (super_admin only)
router.post('/', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const {
      name,
      legal_name,
      registration_number,
      industry,
      contact_person,
      contact_email,
      contact_phone,
      address,
      notes
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Business name is required' });
    }

    const [result] = await pool.query(`
      INSERT INTO businesses (
        name, legal_name, registration_number, industry, contact_person,
        contact_email, contact_phone, address, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      name.trim(),
      legal_name || null,
      registration_number || null,
      industry || null,
      contact_person || null,
      contact_email || null,
      contact_phone || null,
      address || null,
      notes || null
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'CREATE_BUSINESS', 'businesses', result.insertId, null, { name }, req);

    emitToBusiness(req, result.insertId, 'business_updated', { business_id: result.insertId, action: 'create' });

    return res.json({
      success: true,
      message: `Business '${name.trim()}' created successfully!`,
      data: { id: result.insertId }
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Form configuration routes must remain above /:id so their static segments cannot be treated as IDs.
router.get('/:id/categories', authenticateToken, requireRole('super_admin'), validateBusinessId, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM business_form_categories WHERE business_id = ? ORDER BY sort_order, name', [req.params.id]);
    return res.json({ success: true, categories });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/categories', authenticateToken, requireRole('super_admin'), validateBusinessId, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
    const sortOrder = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
    const [result] = await pool.query('INSERT INTO business_form_categories (business_id, name, sort_order) VALUES (?, ?, ?)', [req.params.id, name, sortOrder]);
    return res.json({ success: true, category: { id: result.insertId, business_id: Number(req.params.id), name, sort_order: sortOrder } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'This category already exists for the business' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/categories/:categoryId - rename a category. Products store the category name, so products of this
// business that use the old name are renamed with it (in one transaction).
router.put('/:id/categories/:categoryId', authenticateToken, requireRole('super_admin'), validateBusinessId, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
  if (name.length > 100) return res.status(400).json({ success: false, message: 'Category name is too long (100 characters max)' });
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT * FROM business_form_categories WHERE id = ? AND business_id = ?', [req.params.categoryId, req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Category not found' });
    const old = rows[0];
    await connection.beginTransaction();
    await connection.query('UPDATE business_form_categories SET name = ? WHERE id = ?', [name, old.id]);
    const [moved] = await connection.query('UPDATE products SET category = ? WHERE business_id = ? AND category = ?', [name, req.params.id, old.name]);
    await connection.commit();
    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_FORM_CATEGORY', 'business_form_categories', old.id, { name: old.name }, { name, products_renamed: moved.affectedRows }, req);
    return res.json({ success: true, category: { ...old, name }, products_renamed: moved.affectedRows });
  } catch (err) {
    await connection.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'This category already exists for the business' });
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

router.delete('/:id/categories/:categoryId', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM business_form_categories WHERE id = ? AND business_id = ?', [req.params.categoryId, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Category not found' });
    return res.json({ success: true, message: 'Category removed' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id/variant-attributes', authenticateToken, requireRole('super_admin'), validateBusinessId, async (req, res) => {
  try {
    const [attributes] = await pool.query('SELECT * FROM business_form_fields WHERE business_id = ? ORDER BY sort_order, label', [req.params.id]);
    return res.json({ success: true, attributes });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/variant-attributes', authenticateToken, requireRole('super_admin'), validateBusinessId, async (req, res) => {
  try {
    const attributeKey = String(req.body.attribute_key || '').trim().toLowerCase().replace(/\s+/g, '_');
    const label = String(req.body.label || '').trim();
    const inputType = String(req.body.input_type || 'text').trim();
    const options = parseOptions(req.body.options);
    if (!attributeKey || !/^[a-z][a-z0-9_]*$/.test(attributeKey)) return res.status(400).json({ success: false, message: 'A valid field key is required' });
    if (!label) return res.status(400).json({ success: false, message: 'Field label is required' });
    if (!['text', 'select'].includes(inputType)) return res.status(400).json({ success: false, message: 'Unknown field type' });
    if (inputType === 'select' && options.length === 0) return res.status(400).json({ success: false, message: 'Select fields require at least one option' });
    const sortOrder = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
    const [result] = await pool.query(
      'INSERT INTO business_form_fields (business_id, attribute_key, label, input_type, options, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, attributeKey, label, inputType, inputType === 'select' ? JSON.stringify(options) : null, sortOrder]
    );
    return res.json({ success: true, attribute: { id: result.insertId, business_id: Number(req.params.id), attribute_key: attributeKey, label, input_type: inputType, options, sort_order: sortOrder } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'This field key or label already exists for the business' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/variant-attributes/order - set the order fields appear on the product form. Body: { ids: [fieldId, ...] }
router.put('/:id/variant-attributes/order', authenticateToken, requireRole('super_admin'), validateBusinessId, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) return res.status(400).json({ success: false, message: 'Field order is required' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await connection.query('UPDATE business_form_fields SET sort_order = ? WHERE id = ? AND business_id = ?', [(i + 1) * 10, ids[i], req.params.id]);
    }
    await connection.commit();
    return res.json({ success: true });
  } catch (err) {
    await connection.rollback().catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// PUT /:id/variant-attributes/:fieldId - edit a field's label, answer type and dropdown options.
// The attribute_key never changes, so values already saved on products stay attached to the field.
router.put('/:id/variant-attributes/:fieldId', authenticateToken, requireRole('super_admin'), validateBusinessId, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM business_form_fields WHERE id = ? AND business_id = ?', [req.params.fieldId, req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Field not found' });
    const old = rows[0];
    const label = String(req.body.label ?? old.label).trim();
    const inputType = String(req.body.input_type ?? old.input_type).trim();
    const options = parseOptions(req.body.options ?? old.options);
    if (!label) return res.status(400).json({ success: false, message: 'Field label is required' });
    if (label.length > 100) return res.status(400).json({ success: false, message: 'Field label is too long (100 characters max)' });
    if (!['text', 'select'].includes(inputType)) return res.status(400).json({ success: false, message: 'Unknown field type' });
    if (inputType === 'select' && options.length === 0) return res.status(400).json({ success: false, message: 'Select fields require at least one option' });

    await pool.query(
      'UPDATE business_form_fields SET label = ?, input_type = ?, options = ? WHERE id = ?',
      [label, inputType, inputType === 'select' ? JSON.stringify(options) : null, old.id]
    );

    // Dropdown options that were removed but are still the saved answer on some products (they keep it)
    const removed = inputType === 'select' ? parseOptions(old.options).filter(o => !options.includes(o)) : [];
    let stillUsed = [];
    if (removed.length) {
      const [used] = await pool.query(
        `SELECT pvv.value, COUNT(*) AS products FROM product_variant_values pvv
         JOIN products p ON p.id = pvv.product_id
         WHERE p.business_id = ? AND pvv.attribute_key = ? AND pvv.value IN (?)
         GROUP BY pvv.value`,
        [req.params.id, old.attribute_key, removed]
      );
      stillUsed = used.map(u => ({ value: u.value, products: Number(u.products) }));
    }

    const updated = { ...old, label, input_type: inputType, options: inputType === 'select' ? options : null };
    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_FORM_FIELD', 'business_form_fields', old.id,
      { label: old.label, input_type: old.input_type, options: parseOptions(old.options) },
      { label, input_type: inputType, options: inputType === 'select' ? options : [] }, req);
    return res.json({ success: true, attribute: updated, removed_options_in_use: stillUsed });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Another field already uses this name' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id/variant-attributes/:fieldId', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM business_form_fields WHERE id = ? AND business_id = ?', [req.params.fieldId, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Field not found' });
    return res.json({ success: true, message: 'Field removed' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// GET /:id - get business details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' && parseInt(req.params.id, 10) !== parseInt(req.user.business_id, 10)) {
      return res.status(403).json({ success: false, message: 'Access denied: you may only view your own business.' });
    }
    const [businesses] = await pool.query('SELECT * FROM businesses WHERE id = ?', [req.params.id]);
    if (businesses.length === 0) return res.status(404).json({ success: false, message: 'Business not found' });
    return res.json({ success: true, data: businesses[0], business: businesses[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id - update business (super_admin only)
router.put('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const {
      name,
      legal_name,
      registration_number,
      industry,
      contact_person,
      contact_email,
      contact_phone,
      address,
      notes
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Business name is required' });

    const [existing] = await pool.query('SELECT * FROM businesses WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Business not found' });

    await pool.query(`
      UPDATE businesses SET 
        name = ?, legal_name = ?, registration_number = ?, industry = ?,
        contact_person = ?, contact_email = ?, contact_phone = ?, address = ?, notes = ?
      WHERE id = ?
    `, [
      name.trim(),
      legal_name || null,
      registration_number || null,
      industry || null,
      contact_person || null,
      contact_email || null,
      contact_phone || null,
      address || null,
      notes || null,
      req.params.id
    ]);

    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_BUSINESS', 'businesses', req.params.id, existing[0], { name }, req);

    emitToBusiness(req, req.params.id, 'business_updated', { business_id: req.params.id, action: 'update' });

    return res.json({ success: true, message: 'Business details updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id - delete business (super_admin only with deletion protection)
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const businessId = req.params.id;

    const [existing] = await pool.query('SELECT * FROM businesses WHERE id = ?', [businessId]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Business not found' });

    // Block deletion if branches exist
    const [branches] = await pool.query('SELECT COUNT(*) as count FROM branches WHERE business_id = ?', [businessId]);
    if (branches[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete business '${existing[0].name}': It still has ${branches[0].count} assigned branch(es). Please delete or reassign all branches first.`
      });
    }

    await pool.query('DELETE FROM businesses WHERE id = ?', [businessId]);

    await recordAuditLog(req.user.id, req.user.role, 'DELETE_BUSINESS', 'businesses', businessId, existing[0], null, req);

    emitToBusiness(req, businessId, 'business_updated', { business_id: businessId, action: 'delete' });

    return res.json({ success: true, message: `Business '${existing[0].name}' deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/branches - list branches for a business
router.get('/:id/branches', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' && parseInt(req.params.id, 10) !== parseInt(req.user.business_id, 10)) {
      return res.status(403).json({ success: false, message: 'Access denied: you may only view your own business branches.' });
    }
    const [branches] = await pool.query('SELECT * FROM branches WHERE business_id = ? ORDER BY name', [req.params.id]);
    return res.json({ success: true, data: branches, branches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
