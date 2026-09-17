const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Require Super Admin for audit logs
router.use(authenticateToken, requireRole('super_admin'));

// GET /api/audit
router.get('/', async (req, res) => {
  try {
    const { search, start_date, end_date, limit } = req.query;
    let query = `
      SELECT 
        a.*,
        u.full_name AS user_name,
        u.email AS user_email,
        u.role AS current_user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (a.action LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR a.new_values LIKE ? OR a.old_values LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s);
    }

    if (start_date) {
      query += ` AND DATE(a.created_at) >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND DATE(a.created_at) <= ?`;
      params.push(end_date);
    }

    const maxLimit = parseInt(limit, 10) || 500;
    query += ` ORDER BY a.created_at DESC LIMIT ?`;
    params.push(maxLimit);

    const [logs] = await pool.query(query, params);

    return res.json({
      success: true,
      logs
    });
  } catch (err) {
    console.error('Audit log error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs: ' + err.message });
  }
});

module.exports = router;
