const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { isEmail, USER_ROLES } = require('../utils/validate');
const pool = require('../config/db');
const crypto = require('crypto');
const { authenticateToken, requireRole, recordAuditLog } = require('../middleware/auth');

// Readable temporary passwords (no 0/O, 1/l/I) e.g. "Kp7m-Xw3r-Tz"
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const tempPassword = () => {
  const pick = (n) => Array.from(crypto.randomBytes(n), b => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join('');
  return `${pick(4)}-${pick(4)}-${pick(2)}`;
};
// Never put password hashes in the audit log
const withoutSecrets = (row) => { const { password_hash, ...rest } = row || {}; return rest; };

// Require Super Admin for all user management routes
router.use(authenticateToken, requireRole('super_admin'));

// GET /api/users/stats
router.get('/stats', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN u.role = 'super_admin' THEN 1 ELSE 0 END) as superadmins,
        SUM(CASE WHEN u.role = 'super_admin' AND u.status = 'active' THEN 1 ELSE 0 END) as active_superadmins,
        SUM(CASE WHEN u.role = 'admin' THEN 1 ELSE 0 END) as admins,
        b.name as business_name,
        COUNT(CASE WHEN u.role = 'admin' THEN 1 END) as admin_count
      FROM users u
      LEFT JOIN businesses b ON u.business_id = b.id
      WHERE u.deleted_at IS NULL
      GROUP BY b.id, b.name
    `);
    
    const total = rows.reduce((s,r) => s + parseInt(r.total||0), 0);
    const superadmins = rows.reduce((s,r) => s + parseInt(r.superadmins||0), 0);
    const activeSuperadmins = rows.reduce((s,r) => s + parseInt(r.active_superadmins||0), 0);
    const admins = rows.reduce((s,r) => s + parseInt(r.admins||0), 0);
    const byBusiness = rows.map(r => ({ name: r.business_name || 'Unassigned', count: parseInt(r.admin_count||0) })).filter(b => b.count > 0);

    return res.json({ success: true, stats: { total, superadmins, active_superadmins: activeSuperadmins, admins, byBusiness } });
  } catch (err) {
    console.error('Fetch users stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user stats' });
  }
});

// GET /api/users (All active & registered users)
router.get('/', async (req, res) => {
  try {
    const { status, branch_id, business_id, search } = req.query;
    let query = `
      SELECT 
        u.id, u.email, u.username, u.full_name, u.role, u.is_active, u.status, u.last_login, u.created_at, u.deleted_at,
        u.business_id, u.branch_id,
        b.name AS branch_name, b.branch_code, biz.name AS business_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN businesses biz ON u.business_id = biz.id
      WHERE u.deleted_at IS NULL
    `;
    const params = [];
    if (status && status !== 'all') {
      query += ` AND u.status = ?`;
      params.push(status);
    }
    if (branch_id && branch_id !== 'all' && branch_id !== '') {
      query += ` AND u.branch_id = ?`;
      params.push(parseInt(branch_id, 10));
    } else if (business_id && business_id !== 'all' && business_id !== '') {
      query += ` AND u.business_id = ?`;
      params.push(parseInt(business_id, 10));
    }
    if (search && search.trim()) {
      query += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    query += ` ORDER BY u.role, u.full_name ASC`;

    const [users] = await pool.query(query, params);

    const pendingCount = users.filter(u => u.status === 'pending').length;
    const activeCount = users.filter(u => u.status === 'active').length;

    // Backward compat: set is_active if needed (already in DB though, but we mirror it)
    users.forEach(u => {
      if (u.status === 'pending') u.is_active = 0;
      else if (u.status === 'active') u.is_active = 1;
      else if (u.status === 'declined') u.is_active = 2;
    });

    return res.json({
      success: true,
      users,
      stats: {
        total: users.length,
        active: activeCount,
        pending: pendingCount
      }
    });

  } catch (err) {
    console.error('Fetch users error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch users: ' + err.message });
  }
});

// GET /api/users/pending (Pending Registration Queue)
router.get('/pending', async (req, res) => {
  try {
    const [pendingUsers] = await pool.query(`
      SELECT 
        u.id, u.email, u.username, u.full_name, u.role, u.is_active, u.status, u.created_at,
        b.name AS branch_name, biz.name AS business_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN businesses biz ON u.business_id = biz.id
      WHERE u.status = 'pending' AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `);

    return res.json({
      success: true,
      pendingUsers
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users (Manual Add User)
router.post('/', async (req, res) => {
  try {
    const { full_name, email, password, role, business_id, branch_id } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }

    const emailClean = email.toLowerCase().trim();
    if (!isEmail(emailClean)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be Branch Admin or Super Admin.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Admin accounts must be fully assigned
    if (role === 'admin') {
      if (!business_id || !branch_id) {
        return res.status(400).json({ success: false, message: 'Admin accounts must be assigned to both a business and a branch.' });
      }
      // Validate branch belongs to business
      const [branchCheck] = await pool.query(
        'SELECT id FROM branches WHERE id = ? AND business_id = ?',
        [branch_id, business_id]
      );
      if (branchCheck.length === 0) {
        return res.status(400).json({ success: false, message: 'The selected branch does not belong to the selected business.' });
      }
    }

    const [dup] = await pool.query('SELECT id FROM users WHERE email = ?', [emailClean]);
    if (dup.length > 0) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
    }

    const username = emailClean.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (email, username, password_hash, full_name, role, business_id, branch_id, status, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, NOW())`,
      [emailClean, username, passwordHash, full_name.trim(), role, business_id || null, branch_id || null]
    );

    await recordAuditLog(req.user.id, req.user.role, 'CREATE_USER', 'users', result.insertId, null, { email: emailClean, full_name, role }, req);

    return res.json({
      success: true,
      message: 'User account created successfully!'
    });

  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create user: ' + err.message });
  }
});

// POST /api/users/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const userId = req.params.id;
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await pool.query('UPDATE users SET status = ?, is_active = 1, updated_at = NOW() WHERE id = ?', ['active', userId]);

    await recordAuditLog(req.user.id, req.user.role, 'APPROVE_USER', 'users', userId, { is_active: 0 }, { is_active: 1, status: 'active' }, req);

    return res.json({ success: true, message: `Account for ${users[0].full_name} (${users[0].email}) approved and activated!` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const userId = req.params.id;
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await pool.query('UPDATE users SET status = ?, is_active = 2, updated_at = NOW() WHERE id = ?', ['declined', userId]);

    await recordAuditLog(req.user.id, req.user.role, 'REJECT_USER', 'users', userId, { is_active: 0 }, { is_active: 2, status: 'declined' }, req);

    return res.json({ success: true, message: `Registration for ${users[0].full_name} declined.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/users/:id/suspend
router.patch('/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) return res.status(400).json({ success: false, message: 'Cannot suspend your own account.' });
    await pool.query('UPDATE users SET status = ?, is_active = 0, updated_at = NOW() WHERE id = ?', ['suspended', id]);
    await recordAuditLog(req.user.id, req.user.role, 'USER_SUSPENDED', 'users', id, null, { suspended_by: req.user.email }, req);
    res.json({ success: true, message: 'User suspended.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/users/:id/activate
router.patch('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE users SET status = ?, is_active = 1, updated_at = NOW() WHERE id = ?', ['active', id]);
    await recordAuditLog(req.user.id, req.user.role, 'USER_ACTIVATED', 'users', id, null, { activated_by: req.user.email }, req);
    res.json({ success: true, message: 'User activated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { business_id, branch_id, role } = req.body;

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (role !== undefined && !USER_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be Branch Admin or Super Admin.' });
    }
    const targetRole = role || users[0].role;
    let effectiveBusiness = business_id || null;
    let effectiveBranch   = branch_id   || null;

    // Admin accounts must be fully assigned (fields omitted from the request keep their current value)
    if (targetRole === 'admin') {
      if (business_id === undefined) effectiveBusiness = users[0].business_id;
      if (branch_id === undefined) effectiveBranch = users[0].branch_id;
      if (!effectiveBusiness || !effectiveBranch) {
        return res.status(400).json({ success: false, message: 'Admin accounts must be assigned to both a business and a branch.' });
      }
      const [branchCheck] = await pool.query(
        'SELECT id FROM branches WHERE id = ? AND business_id = ?',
        [effectiveBranch, effectiveBusiness]
      );
      if (branchCheck.length === 0) {
        return res.status(400).json({ success: false, message: 'The selected branch does not belong to the selected business.' });
      }
    }

    await pool.query(
      'UPDATE users SET business_id = ?, branch_id = ?, role = ?, updated_at = NOW() WHERE id = ?',
      [effectiveBusiness, effectiveBranch, targetRole, userId]
    );

    await recordAuditLog(req.user.id, req.user.role, 'UPDATE_USER', 'users', userId, withoutSecrets(users[0]), { business_id, branch_id, role }, req);

    return res.json({ success: true, message: 'User updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/:id/reset-password - Super Admin sets a temporary password for a user who forgot theirs.
// Body: { password? } (generated when omitted). The temporary password is returned once, so it can be passed
// on to the user, and the user must choose a new one the next time they sign in.
router.post('/:id/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Use “Change password” in your account menu to change your own password.' });
    }
    const [users] = await pool.query('SELECT id, email, full_name, role, status FROM users WHERE id = ? AND deleted_at IS NULL', [userId]);
    if (!users.length) return res.status(404).json({ success: false, message: 'User not found.' });

    const custom = typeof req.body.password === 'string' ? req.body.password.trim() : '';
    if (custom && custom.length < 6) {
      return res.status(400).json({ success: false, message: 'Temporary password must be at least 6 characters.' });
    }
    const temporary = custom || tempPassword();
    const hash = await bcrypt.hash(temporary, 10);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = NOW() WHERE id = ?', [hash, userId]);

    await recordAuditLog(req.user.id, req.user.role, 'RESET_PASSWORD', 'users', userId, null,
      { email: users[0].email, full_name: users[0].full_name, generated: !custom }, req);
    return res.json({ success: true, temporary_password: temporary, user: users[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id (Soft Deletion)
router.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own active administrator account.' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetUser = users[0];

    // Soft delete user
    await pool.query('UPDATE users SET deleted_at = NOW(), status = ?, is_active = 2 WHERE id = ?', ['declined', userId]);

    await recordAuditLog(req.user.id, req.user.role, 'DELETE_USER', 'users', userId, { email: targetUser.email, full_name: targetUser.full_name }, null, req);

    return res.json({ success: true, message: `User account (${targetUser.full_name}) successfully removed.` });

  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete user: ' + err.message });
  }
});

module.exports = router;
