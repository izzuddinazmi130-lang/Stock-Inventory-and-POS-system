const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');

// GET / - list all businesses with active_branch_count
router.get('/', async (req, res) => {
  try {
    const [businesses] = await pool.query(`
      SELECT 
        b.*,
        (SELECT COUNT(*) FROM branches br WHERE br.business_id = b.id AND br.is_active = 1) AS active_branch_count,
        (SELECT COUNT(*) FROM branches br WHERE br.business_id = b.id) AS total_branch_count
      FROM businesses b
      ORDER BY b.name ASC
    `);
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

    const io = req.app.get('io');
    if (io) io.emit('business_updated', { business_id: result.insertId, action: 'create' });

    return res.json({
      success: true,
      message: `Business '${name.trim()}' created successfully!`,
      data: { id: result.insertId }
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id - get business details
router.get('/:id', async (req, res) => {
  try {
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

    const io = req.app.get('io');
    if (io) io.emit('business_updated', { business_id: req.params.id, action: 'update' });

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

    const io = req.app.get('io');
    if (io) io.emit('business_updated', { business_id: businessId, action: 'delete' });

    return res.json({ success: true, message: `Business '${existing[0].name}' deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/branches - list branches for a business
router.get('/:id/branches', async (req, res) => {
  try {
    const [branches] = await pool.query('SELECT * FROM branches WHERE business_id = ? ORDER BY name', [req.params.id]);
    return res.json({ success: true, data: branches, branches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
