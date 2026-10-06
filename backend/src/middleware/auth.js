const jwt = require('jsonwebtoken');
const pool = require('../config/db');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Set it in backend/.env and restart.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user in database
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.username, u.full_name, u.role, u.is_active, u.status, u.deleted_at, u.must_change_password,
             u.business_id, u.branch_id,
             b.name AS branch_name, b.is_active AS branch_active,
             biz.name AS business_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN businesses biz ON u.business_id = biz.id
      WHERE u.id = ?
    `, [decoded.id]);
    
    // is_active is 2 for declined/deleted accounts (truthy), so check the account status explicitly
    const account = users[0];
    if (!account || account.deleted_at || account.status !== 'active' || Number(account.is_active) !== 1) {
      res.clearCookie('token');
      return res.status(401).json({ success: false, code: 'ACCOUNT_INACTIVE', message: 'Your account is no longer active. Please contact HQ.' });
    }

    req.user = users[0];

    // After a password reset the user must pick a new password before doing anything else
    if (req.user.must_change_password) {
      const allowed = ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password'];
      if (!allowed.includes(req.originalUrl.split('?')[0])) {
        return res.status(403).json({ success: false, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Please choose a new password to continue.' });
      }
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

const recordAuditLog = async (userId, userRole, action, entityType = null, entityId = null, oldValues = null, newValues = null, req = null) => {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const ua = req ? req.headers['user-agent'] : null;

    await pool.query(
      `INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        userRole,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip,
        ua
      ]
    );
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  recordAuditLog,
  JWT_SECRET
};
