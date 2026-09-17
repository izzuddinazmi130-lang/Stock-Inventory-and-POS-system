<?php
/**
 * Pending User Approvals — Super Admin Control Panel
 * Review, Approve, Reject, or Delete New User Registration Requests
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/UserApproval.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireRole('super_admin');

$admin = Auth::getCurrentUser();
$approvalManager = new UserApproval();

$notice = '';
$noticeType = 'success';

// Handle Action Submissions (Approve, Reject, Delete)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $targetUserId = (int)($_POST['user_id'] ?? 0);
    $adminId = (int)($admin['id'] ?? 0);

    if ($targetUserId > 0) {
        if ($action === 'approve') {
            if ($approvalManager->approve($targetUserId, $adminId)) {
                $notice = 'User account approved successfully. The user may now sign in.';
                $noticeType = 'success';
            } else {
                $notice = 'Failed to approve user account.';
                $noticeType = 'danger';
            }
        } elseif ($action === 'reject') {
            $reason = trim($_POST['reason'] ?? 'Registration rejected by Super Admin');
            if ($approvalManager->reject($targetUserId, $adminId, $reason)) {
                $notice = 'User registration declined.';
                $noticeType = 'warning';
            } else {
                $notice = 'Failed to update user status.';
                $noticeType = 'danger';
            }
        } elseif ($action === 'delete') {
            if ($approvalManager->deleteUser($targetUserId, $adminId)) {
                $notice = 'Pending user record was permanently removed.';
                $noticeType = 'info';
            } else {
                $notice = 'Failed to delete user record.';
                $noticeType = 'danger';
            }
        }
    }
}

// Fetch pending users queue
$pendingUsers = $approvalManager->getPending();
$page_title = 'Pending User Approvals — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>Pending User Approvals</h2>
                <p class="subtitle">Review self-registration submissions, verify warehouse facility assignments, and grant portal access</p>
            </div>
            <div class="header-actions">
                <a href="<?php echo htmlspecialchars(app_url('users/index.php')); ?>" class="btn-modern btn-ghost">
                    <i class="fas fa-users"></i> User Directory
                </a>
                <a href="<?php echo htmlspecialchars(app_url('users/add.php')); ?>" class="btn-modern btn-primary-dark">
                    <i class="fas fa-plus"></i> Manual Add
                </a>
            </div>
        </div>

        <?php if (!empty($notice)): ?>
            <div class="alert alert-<?php echo $noticeType === 'danger' ? 'danger bg-danger text-white' : ($noticeType === 'warning' ? 'warning bg-warning text-dark' : 'success bg-success text-white'); ?> border-0 mb-4 d-flex align-items-center justify-content-between">
                <div><i class="fas fa-info-circle me-2"></i><?php echo htmlspecialchars($notice); ?></div>
                <a href="pending.php" class="text-white text-decoration-none small opacity-75"><i class="fas fa-times"></i></a>
            </div>
        <?php endif; ?>

        <!-- Pending Queue Panel -->
        <div class="data-panel">
            <div class="data-panel-header">
                <h6><i class="fas fa-user-clock me-2 text-primary"></i>Registration Queue (<?php echo count($pendingUsers); ?> Pending)</h6>
                <span class="text-muted small">Real-time review</span>
            </div>
            
            <?php if (empty($pendingUsers)): ?>
                <div class="empty-state py-5">
                    <i class="fas fa-check-circle fa-4x d-block text-success mb-3 opacity-75"></i>
                    <h5 class="cell-strong text-white mb-1">All Caught Up!</h5>
                    <p class="cell-muted mb-0">There are currently no registration requests pending approval. New registrations from the public portal will appear here.</p>
                </div>
            <?php else: ?>
                <div class="table-responsive">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Applicant Details</th>
                                <th>Requested Role</th>
                                <th>Assigned Warehouse</th>
                                <th>Submitted At</th>
                                <th>Status</th>
                                <th style="text-align: right;">Authorization Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($pendingUsers as $pUser): ?>
                                <tr>
                                    <td>
                                        <div class="cell-strong"><?php echo htmlspecialchars($pUser['full_name']); ?></div>
                                        <div class="cell-muted font-monospace small text-primary"><?php echo htmlspecialchars($pUser['email']); ?></div>
                                    </td>
                                    <td>
                                        <?php if ($pUser['role'] === 'admin_kaftanasia'): ?>
                                            <span class="badge-modern badge-gold"><i class="fas fa-shirt me-1"></i>Kaftanasia Admin</span>
                                        <?php elseif ($pUser['role'] === 'admin_astech'): ?>
                                            <span class="badge-modern badge-red"><i class="fas fa-laptop me-1"></i>Astech Admin</span>
                                        <?php else: ?>
                                            <span class="badge-modern badge-purple"><i class="fas fa-shield-alt me-1"></i><?php echo htmlspecialchars($pUser['role']); ?></span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <span class="badge-modern <?php echo ($pUser['assigned_warehouse_id'] == 1) ? 'badge-gold' : 'badge-red'; ?>">
                                            <i class="fas fa-warehouse me-1"></i>
                                            <?php echo htmlspecialchars($pUser['warehouse_name'] ?? ('Warehouse #' . $pUser['assigned_warehouse_id'])); ?>
                                        </span>
                                    </td>
                                    <td class="cell-muted small">
                                        <?php echo htmlspecialchars(date('d M Y, h:i A', strtotime($pUser['created_at']))); ?>
                                    </td>
                                    <td>
                                        <span class="badge-modern badge-gold"><i class="fas fa-clock me-1"></i>PENDING</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <div class="d-inline-flex gap-1 justify-content-end">
                                            <!-- Approve Action -->
                                            <form method="POST" style="display: inline;" onsubmit="return confirm('Approve this user account? They will be granted immediate login access.');">
                                                <input type="hidden" name="action" value="approve">
                                                <input type="hidden" name="user_id" value="<?php echo (int)$pUser['id']; ?>">
                                                <button type="submit" class="btn-modern btn-success-dark btn-modern-sm" title="Approve & Grant Login">
                                                    <i class="fas fa-check"></i> Approve
                                                </button>
                                            </form>

                                            <!-- Reject Action -->
                                            <form method="POST" style="display: inline;" onsubmit="return confirm('Decline this registration request?');">
                                                <input type="hidden" name="action" value="reject">
                                                <input type="hidden" name="user_id" value="<?php echo (int)$pUser['id']; ?>">
                                                <button type="submit" class="btn-modern btn-ghost-warning btn-modern-sm" title="Decline Request">
                                                    <i class="fas fa-ban"></i> Decline
                                                </button>
                                            </form>

                                            <!-- Delete Action -->
                                            <form method="POST" style="display: inline;" onsubmit="return confirm('Permanently delete this pending registration record?');">
                                                <input type="hidden" name="action" value="delete">
                                                <input type="hidden" name="user_id" value="<?php echo (int)$pUser['id']; ?>">
                                                <button type="submit" class="btn-modern btn-ghost-danger btn-modern-sm" title="Delete Record">
                                                    <i class="fas fa-trash-alt"></i>
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
