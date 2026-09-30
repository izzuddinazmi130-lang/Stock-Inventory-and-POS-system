/**
 * scope.js — Shared business/branch scoping helper.
 *
 * resolveScope(req, { level }) -> { businessId, branchId }
 *
 * level 'branch':
 *   - admin : both forced from token; query values are ignored.
 *   - super_admin : both from query, either may be null (= all).
 *
 * level 'business':
 *   - admin : businessId forced from token.
 *             branchId from query only if it belongs to user.business_id (else 403); null = all branches.
 *   - super_admin : both from query, either may be null (= all).
 *
 * An admin with a null business_id or branch_id is always rejected (403) — never "no restriction".
 * For super_admin, a branch_id that does not belong to the given business_id is rejected (400).
 */

const pool = require('../config/db');

class ScopeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Parse an optional numeric id from a query value. '', 'all', undefined → null.
function parseOptionalId(value) {
  if (value === undefined || value === null || value === '' || value === 'all') return null;
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0) throw new ScopeError(400, `Invalid id: ${value}`);
  return id;
}

async function branchBelongsToBusiness(branchId, businessId) {
  const [rows] = await pool.query(
    'SELECT id FROM branches WHERE id = ? AND business_id = ?',
    [branchId, businessId]
  );
  return rows.length > 0;
}

/**
 * @param {import('express').Request} req
 * @param {{ level: 'branch' | 'business' }} options
 * @returns {Promise<{ businessId: number|null, branchId: number|null }>}
 * @throws {ScopeError} on scope violation
 */
async function resolveScope(req, { level }) {
  const user = req.user;

  if (user.role === 'admin') {
    if (!user.business_id) {
      throw new ScopeError(403, 'Access denied: your account is not assigned to a business.');
    }
    if (!user.branch_id) {
      throw new ScopeError(403, 'Access denied: your account is not assigned to a branch.');
    }

    const businessId = parseInt(user.business_id, 10);
    const ownBranchId = parseInt(user.branch_id, 10);

    if (level === 'branch') {
      return { businessId, branchId: ownBranchId };
    }

    // level === 'business'
    const queryBranchId = parseOptionalId(req.query.branch_id);
    if (queryBranchId && queryBranchId !== ownBranchId && !(await branchBelongsToBusiness(queryBranchId, businessId))) {
      throw new ScopeError(403, 'Access denied: that branch does not belong to your business.');
    }
    return { businessId, branchId: queryBranchId };
  }

  if (user.role !== 'super_admin') {
    throw new ScopeError(403, 'Access denied: insufficient permissions.');
  }

  const businessId = parseOptionalId(req.query.business_id);
  const branchId = parseOptionalId(req.query.branch_id);

  if (businessId && branchId && !(await branchBelongsToBusiness(branchId, businessId))) {
    throw new ScopeError(400, 'The specified branch does not belong to the specified business.');
  }

  return { businessId, branchId };
}

// Sends the response for a ScopeError and returns true; returns false for any other error.
function handleScopeError(res, err) {
  if (err instanceof ScopeError) {
    res.status(err.status).json({ success: false, message: err.message });
    return true;
  }
  return false;
}

module.exports = { resolveScope, handleScopeError, ScopeError };
