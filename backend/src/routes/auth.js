const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isEmail } = require('../utils/validate');
const pool = require('../config/db');
const { authenticateToken, recordAuditLog, clientIp, JWT_SECRET } = require('../middleware/auth');
const { isMailConfigured, sendMail, resetCodeEmail } = require('../utils/mailer');

// Sign the user in on this device: a 7-day session cookie
function startSession(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, branch_id: user.branch_id, business_id: user.business_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    secure: false, // set true in production HTTPS
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return token;
}

const publicUser = (user) => ({
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
});

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

    const token = startSession(res, user);

    // Record audit log
    await recordAuditLog(user.id, user.role, 'LOGIN', 'users', user.id, null, { email: user.email }, req);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: publicUser(user)
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
    // Other devices signed in with the old password are signed out; this device gets a fresh session
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = NOW(), updated_at = NOW() WHERE id = ?', [newHash, req.user.id]);
    startSession(res, req.user);
    await recordAuditLog(req.user.id, req.user.role, 'CHANGE_PASSWORD', 'users', req.user.id, null, { after_reset: Boolean(req.user.must_change_password) }, req);
    return res.json({ success: true, message: 'Password changed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Forgot password: a 6-digit code sent by email ─────────────────────────────────────────────
const CODE_MINUTES = 15;        // a code works for 15 minutes
const MAX_TRIES = 5;            // wrong codes before the code is cancelled
const MAX_CODES = 5;            // codes per account per 15 minutes
const RESEND_SECONDS = 60;      // wait between two codes
const SENT_MESSAGE = 'If this email has an account, we’ve sent a 6-digit code to it. It expires in 15 minutes.';
const BAD_CODE = 'This code is wrong or has expired. Request a new code.';

// Requests per IP address (in memory): stops one device from flooding the form
const ipHits = new Map();
const tooManyFromIp = (ip) => {
  const now = Date.now(), windowMs = 15 * 60 * 1000;
  const hits = (ipHits.get(ip) || []).filter(t => now - t < windowMs);
  hits.push(now);
  ipHits.set(ip, hits);
  if (ipHits.size > 5000) ipHits.clear();
  return hits.length > 20;
};

const findResettableUser = async (email) => {
  const [rows] = await pool.query(`
    SELECT u.*, b.name AS branch_name, b.branch_code AS branch_code, biz.name AS business_name
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    LEFT JOIN businesses biz ON u.business_id = biz.id
    WHERE u.email = ? AND u.deleted_at IS NULL AND u.status = 'active' AND u.is_active = 1
  `, [email]);
  return rows[0] || null;
};

// POST /api/auth/forgot-password { email, lang } → emails a code. Same answer whether or not the email has an account.
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!isEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    if (!isMailConfigured()) {
      return res.status(503).json({ success: false, code: 'EMAIL_OFF', message: 'Password reset by email is not set up yet. Ask your HQ Super Admin to reset your password.' });
    }
    const ip = clientIp(req);
    if (tooManyFromIp(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please wait a few minutes and try again.' });
    }

    const user = await findResettableUser(email);
    if (!user) return res.json({ success: true, message: SENT_MESSAGE });

    const [[recent]] = await pool.query(
      `SELECT COUNT(*) AS n, MAX(created_at) AS last_at, TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) AS since
       FROM password_resets WHERE user_id = ? AND created_at > NOW() - INTERVAL ? MINUTE`,
      [user.id, CODE_MINUTES]
    );
    // Skip when a code was just sent or too many were sent (the earlier email is still valid). The answer stays
    // the same so it can't reveal which emails have accounts; HQ can see the skipped request in the activity log.
    if (recent.n >= MAX_CODES || (recent.last_at && recent.since < RESEND_SECONDS)) {
      await recordAuditLog(user.id, user.role, 'PASSWORD_RESET_LIMITED', 'users', user.id, null,
        { email: user.email, reason: recent.n >= MAX_CODES ? 'too_many_codes' : 'too_soon' }, req);
      return res.json({ success: true, message: SENT_MESSAGE });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    // A new code replaces any earlier one
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);
    const [ins] = await pool.query(
      'INSERT INTO password_resets (user_id, code_hash, expires_at, ip_address) VALUES (?, ?, NOW() + INTERVAL ? MINUTE, ?)',
      [user.id, codeHash, CODE_MINUTES, String(ip).slice(0, 45)]
    );

    const mail = resetCodeEmail({ name: user.full_name, code, minutes: CODE_MINUTES, lang: req.body.lang === 'ms' ? 'ms' : 'en' });
    try {
      await sendMail({ to: user.email, ...mail });
    } catch (mailErr) {
      console.error('Reset email failed:', mailErr.message);
      await recordAuditLog(user.id, user.role, 'PASSWORD_RESET_EMAIL_FAILED', 'users', user.id, null,
        { email: user.email, error: `${mailErr.code || mailErr.responseCode || ''} ${mailErr.message}`.trim().slice(0, 300) }, req);
      await pool.query('DELETE FROM password_resets WHERE id = ?', [ins.insertId]); // not sent: doesn't count towards the limits
      return res.status(502).json({ success: false, code: 'EMAIL_FAILED', message: 'The email could not be sent. Try again in a few minutes, or ask your HQ Super Admin to reset your password.' });
    }

    await recordAuditLog(user.id, user.role, 'PASSWORD_RESET_REQUESTED', 'users', user.id, null, { email: user.email }, req);
    return res.json({ success: true, message: SENT_MESSAGE });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/reset-password { email, code, new_password } → sets the password and signs the user in
router.post('/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const code = String(req.body.code || '').replace(/\s+/g, '');
    const newPassword = String(req.body.new_password || '');
    if (!isEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, code: 'CODE_INVALID', message: 'Enter the 6-digit code from the email.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, code: 'weak_password', message: 'New password must be at least 6 characters.' });
    }

    const user = await findResettableUser(email);
    const [rows] = user
      ? await pool.query(
          'SELECT * FROM password_resets WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
          [user.id])
      : [[]];
    const reset = rows[0];
    if (!user || !reset) return res.status(400).json({ success: false, code: 'CODE_INVALID', message: BAD_CODE });

    if (!(await bcrypt.compare(code, reset.code_hash))) {
      const tries = reset.attempts + 1;
      if (tries >= MAX_TRIES) {
        await pool.query('UPDATE password_resets SET attempts = ?, used_at = NOW() WHERE id = ?', [tries, reset.id]);
        return res.status(400).json({ success: false, code: 'CODE_LOCKED', message: 'Too many wrong tries. Request a new code.' });
      }
      await pool.query('UPDATE password_resets SET attempts = ? WHERE id = ?', [tries, reset.id]);
      return res.status(400).json({ success: false, code: 'CODE_WRONG', attempts_left: MAX_TRIES - tries, message: 'This code is wrong. Check the email and try again.' });
    }

    // Correct: new password, every other session ends, the code is used up, and this device is signed in
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = NOW(), last_login = NOW(), updated_at = NOW() WHERE id = ?',
      [hash, user.id]
    );
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);
    const token = startSession(res, user);
    await recordAuditLog(user.id, user.role, 'PASSWORD_RESET_BY_EMAIL', 'users', user.id, null, { email: user.email }, req);
    return res.json({ success: true, message: 'Password changed. You are now signed in.', token, user: { ...publicUser(user), must_change_password: false } });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/auth/reset-available → whether the sign-in page can offer "reset by email"
router.get('/reset-available', (req, res) => res.json({ success: true, available: isMailConfigured() }));

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
    if (!isEmail(emailClean)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    // Verify branch belongs to business
    const [branchRows] = await pool.query(
      'SELECT id FROM branches WHERE id = ? AND business_id = ? AND is_active = 1',
      [branch_id, business_id]
    );
    if (branchRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Choose an open branch of that business.' });
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
