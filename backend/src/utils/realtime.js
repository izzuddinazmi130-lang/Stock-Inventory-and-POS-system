/**
 * realtime.js — Scoped Socket.io emits.
 *
 * Every authenticated socket joins `super_admin` (super admins), or `business_<id>` and
 * `branch_<id>` (branch admins) — see server.js. Emit through these helpers instead of
 * io.emit() so events never reach clients of another business.
 */

// Emit to everyone in a business (all its branch admins) plus all super admins.
function emitToBusiness(req, businessId, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  const rooms = ['super_admin'];
  if (businessId) rooms.push(`business_${businessId}`);
  io.to(rooms).emit(event, payload);
}

module.exports = { emitToBusiness };
