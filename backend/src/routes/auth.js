const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken, recordAuditLog, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both email/username and password.' });
    }

    const inputClean = email.trim();

    // Query user by email or username joined with branch and business
    const [users] = await pool.query(`
      SELECT u.*,
             b.name AS branch_name,
             b.branch_code AS branch_code,
             biz.name AS business_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN businesses biz ON u.business_id = biz.id
      WHERE u.email = ? OR u.username = ?
    `, [inputClean, inputClean]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = users[0];

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact HQ administration.' });
    }
    if (user.status === 'pending' || user.is_active === 0) {
      return res.status(403).json({
        success: false,
        code: 'pending_approval',
        message: 'Your account registration is currently pending Super Admin review.'
      });
    }

    if (user.status === 'declined' || user.is_active === 2) {
      return res.status(403).json({
        success: false,
        code: 'account_declined',
        message: 'Your account registration was declined. Please contact HQ administration.'
      });
    }

    // Verify password
    let passwordMatch = false;
    if (user.password_hash.startsWith('$2y$') || user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
      // Modern bcrypt standard ($2y$ converted to $2a$ for bcryptjs compatibility if needed)
      const formattedHash = user.password_hash.replace(/^\$2y\$/, '$2a$');
      passwordMatch = await bcrypt.compare(password, formattedHash);
    } else {
      passwordMatch = (password === user.password_hash);
    }

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        business_id: user.business_id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // set true in production HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Record audit log
    await recordAuditLog(user.id, user.role, 'LOGIN', 'users', user.id, null, { email: user.email }, req);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch_name,
        branch_code: user.branch_code,
        business_id: user.business_id,
        business_name: user.business_name,
        must_change_password: Boolean(user.must_change_password)
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.username, u.full_name, u.role, u.is_active,
             u.business_id, u.branch_id, u.must_change_password,
             b.name AS branch_name,
             b.branch_code AS branch_code,
             biz.name AS business_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN businesses biz ON u.business_id = biz.id
      WHERE u.id = ? AND u.is_active = 1
    `, [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      user: { ...users[0], must_change_password: Boolean(users[0].must_change_password) }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/change-password - the signed-in user changes their own password.
// Also how a user replaces a temporary password after a Super Admin reset.
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Enter your current password and a new password.' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ success: false, code: 'weak_password', message: 'New password must be at least 6 characters.' });
    }
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    const hash = rows[0].password_hash.replace(/^\$2y\$/, '$2a$');
    const matches = hash.startsWith('$2') ? await bcrypt.compare(current_password, hash) : current_password === rows[0].password_hash;
    if (!matches) {
      return res.status(400).json({ success: false, code: 'wrong_password', message: 'Your current password is incorrect.' });
    }
    if (current_password === new_password) {
      return res.status(400).json({ success: false, code: 'same_password', message: 'Choose a password different from the current one.' });
    }

    const newHash = await bcrypt.hash(String(new_password), 10);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?', [newHash, req.user.id]);
    await recordAuditLog(req.user.id, req.user.role, 'CHANGE_PASSWORD', 'users', req.user.id, null, { after_reset: Boolean(req.user.must_change_password) }, req);
    return res.json({ success: true, message: 'Password changed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  if (req.user) {
    await recordAuditLog(req.user.id, req.user.role, 'LOGOUT', 'users', req.user.id, null, null, req);
  }
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/register-options (Public) - minimal id/name lists for the self-registration form.
// ?business_id=X returns that business's active branches. Nothing beyond id and name is exposed.
router.get('/register-options', async (req, res) => {
  try {
    if (req.query.business_id) {
      const [branches] = await pool.query(
        'SELECT id, name FROM branches WHERE business_id = ? AND is_active = 1 ORDER BY name',
        [req.query.business_id]
      );
      return res.json({ success: true, data: branches });
    }
    const [businesses] = await pool.query('SELECT id, name FROM businesses ORDER BY name');
    return res.json({ success: true, data: businesses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/register (Public Self-Registration)
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, business_id, branch_id } = req.body;

    if (!full_name || !email || !password || !business_id || !branch_id) {
      return res.status(400).json({ success: false, message: 'Full name, email, password, business, and branch are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const emailClean = email.toLowerCase().trim();

    // Verify branch belongs to business
    const [branchRows] = await pool.query(
      'SELECT id FROM branches WHERE id = ? AND business_id = ?',
      [branch_id, business_id]
    );
    if (branchRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid business/branch combination.' });
    }

    // Check duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [emailClean]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const username = emailClean.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (email, username, password_hash, full_name, role, business_id, branch_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?, ?, 0, NOW())`,
      [emailClean, username, passwordHash, full_name, business_id, branch_id]
    );

    await recordAuditLog(result.insertId, 'admin', 'REGISTER_PENDING', 'users', result.insertId, null, { email: emailClean, full_name, business_id, branch_id }, req);

    return res.json({
      success: true,
      message: 'Registration submitted successfully! Your account is pending Super Admin review.'
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed: ' + err.message });
  }
});

module.exports = router;
