// Emergency password reset from the server, for when no Super Admin can sign in to reset it in the app.
//
// Usage (from backend/):
//   node src/scripts/reset-password.js <email or username>               generates a temporary password
//   node src/scripts/reset-password.js <email or username> <password>    uses the password you give
//
// The user must choose a new password the next time they sign in. The reset is written to the audit log.

const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('../config/db');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const pick = (n) => Array.from(crypto.randomBytes(n), b => ALPHABET[b % ALPHABET.length]).join('');

(async () => {
  const [login, given] = process.argv.slice(2);
  if (!login) {
    console.log('Usage: node src/scripts/reset-password.js <email or username> [new temporary password]');
    process.exit(1);
  }
  if (given && given.length < 6) {
    console.error('The temporary password must be at least 6 characters.');
    process.exit(1);
  }

  const [users] = await pool.query(
    'SELECT id, email, full_name, role FROM users WHERE (email = ? OR username = ?) AND deleted_at IS NULL',
    [login.toLowerCase().trim(), login.trim()]
  );
  if (!users.length) {
    console.error(`No user found for "${login}".`);
    process.exit(1);
  }
  const user = users[0];
  const temporary = given || `${pick(4)}-${pick(4)}-${pick(2)}`;

  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 1, password_changed_at = NOW(), updated_at = NOW() WHERE id = ?',
    [await bcrypt.hash(temporary, 10), user.id]
  );
  await pool.query(
    `INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, new_values, ip_address, user_agent)
     VALUES (NULL, NULL, 'RESET_PASSWORD', 'users', ?, ?, '127.0.0.1', 'reset-password script')`,
    [user.id, JSON.stringify({ email: user.email, full_name: user.full_name, via: 'server script' })]
  );

  console.log(`\nPassword reset for ${user.full_name} <${user.email}> (${user.role})`);
  console.log(`Temporary password: ${temporary}`);
  console.log('They will be asked to choose a new password after signing in.\n');
  process.exit(0);
})().catch(err => { console.error('Reset failed:', err.message); process.exit(1); });
