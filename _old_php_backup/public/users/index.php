<?php
/**
 * User Management - Super Admin Only
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireRole('super_admin');

$db = Database::getInstance()->getConnection();
$user = SessionManager::getUser();

// Handle user status toggle
if (isset($_GET['toggle'])) {
    $user_id = (int)$_GET['toggle'];
    $stmt = $db->prepare("UPDATE users SET is_active = NOT is_active WHERE id = ?");
    $stmt->execute([$user_id]);
    header('Location: index.php?message=User+status+successfully+updated');
    exit;
}

// Handle user deletion
if (isset($_GET['delete'])) {
    $user_id = (int)$_GET['delete'];
    if ($user_id === (int)$user['id']) {
        header('Location: index.php?error=' . urlencode('You cannot delete your own active administrator account.'));
        exit;
    }

    try {
        $db->beginTransaction();

        $stmt = $db->prepare("SELECT id, full_name, email, role FROM users WHERE id = ?");
        $stmt->execute([$user_id]);
        $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$targetUser) {
            throw new Exception('User record not found.');
        }

        // Explicitly nullify references in child tables before deletion
        $db->prepare("UPDATE audit_logs SET user_id = NULL WHERE user_id = ?")->execute([$user_id]);
        $db->prepare("UPDATE damage_returns SET processed_by = NULL WHERE processed_by = ?")->execute([$user_id]);
        $db->prepare("UPDATE inventory_transactions SET performed_by = NULL WHERE performed_by = ?")->execute([$user_id]);
        $db->prepare("UPDATE master_products SET created_by = NULL WHERE created_by = ?")->execute([$user_id]);
        $db->prepare("UPDATE qr_codes SET generated_by = NULL WHERE generated_by = ?")->execute([$user_id]);
        $db->prepare("UPDATE stock_movements SET performed_by = NULL WHERE performed_by = ?")->execute([$user_id]);

        // Delete user record
        $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$user_id]);

        // Record deletion event in audit_logs
        $auditStmt = $db->prepare("
            INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, new_values, ip_address, created_at)
            VALUES (?, 'super_admin', 'DELETE_USER', 'users', ?, ?, ?, NOW())
        ");
        $auditStmt->execute([
            $user['id'],
            $user_id,
            json_encode(['deleted_email' => $targetUser['email'], 'deleted_name' => $targetUser['full_name'], 'deleted_role' => $targetUser['role']]),
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        $db->commit();
        header('Location: index.php?message=' . urlencode("User account ({$targetUser['full_name']}) was successfully removed."));
        exit;
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("User deletion error: " . $e->getMessage());
        header('Location: index.php?error=' . urlencode('Failed to delete user: ' . $e->getMessage()));
        exit;
    }
}

// Get all users
$stmt = $db->query("
    SELECT 
        u.*,
        w.name as warehouse_name,
        CASE 
            WHEN u.last_login IS NOT NULL THEN DATEDIFF(NOW(), u.last_login)
            ELSE NULL 
        END as days_since_login
    FROM users u
    LEFT JOIN warehouses w ON u.assigned_warehouse_id = w.id
    ORDER BY u.role, u.full_name
");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Counts
$totalUsers = count($users);
$activeUsers = 0;
$superAdmins = 0;
$branchAdmins = 0;

foreach ($users as $u) {
    if (!empty($u['is_active'])) $activeUsers++;
    if ($u['role'] === 'super_admin') $superAdmins++;
    else $branchAdmins++;
}

// Check pending approvals count
$pendingCount = 0;
try {
    $pendingCount = (int)$db->query("SELECT COUNT(*) FROM users WHERE status = 'pending'")->fetchColumn();
} catch (Exception $e) {}

$page_title = 'User Management — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>User Accounts & Permissions</h2>
                <p class="subtitle">Administer system users, assigned roles, and warehouse isolation access</p>
            </div>
            <div class="header-actions">
                <?php if ($pendingCount > 0): ?>
                    <a href="<?php echo app_url('users/pending.php'); ?>" class="btn-modern btn-ghost-warning">
                        <i class="fas fa-user-clock"></i> Pending Approvals (<?php echo $pendingCount; ?>)
                    </a>
                <?php endif; ?>
                <a href="add.php" class="btn-modern btn-primary-dark">
                    <i class="fas fa-user-plus"></i> Add New User
                </a>
            </div>
        </div>

        <?php if (isset($_GET['message'])): ?>
            <div class="alert alert-success bg-success text-white border-0 mb-4 d-flex align-items-center justify-content-between">
                <div><i class="fas fa-check-circle me-2"></i><?php echo htmlspecialchars($_GET['message']); ?></div>
                <a href="index.php" class="text-white text-decoration-none small opacity-75"><i class="fas fa-times"></i></a>
            </div>
        <?php endif; ?>

        <?php if (isset($_GET['error'])): ?>
            <div class="alert alert-danger bg-danger text-white border-0 mb-4 d-flex align-items-center justify-content-between">
                <div><i class="fas fa-circle-exclamation me-2"></i><?php echo htmlspecialchars($_GET['error']); ?></div>
                <a href="index.php" class="text-white text-decoration-none small opacity-75"><i class="fas fa-times"></i></a>
            </div>
        <?php endif; ?>

        <!-- KPI Metrics -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Total System Users</div>
                <div class="kpi-value"><?php echo $totalUsers; ?></div>
                <div class="kpi-meta">All registered accounts</div>
            </div>
            <div class="kpi-card accent-green">
                <div class="kpi-label">Active Accounts</div>
                <div class="kpi-value green"><?php echo $activeUsers; ?></div>
                <div class="kpi-meta">Granted active access</div>
            </div>
            <div class="kpi-card accent-indigo">
                <div class="kpi-label">Super Admins</div>
                <div class="kpi-value"><?php echo $superAdmins; ?></div>
                <div class="kpi-meta">Full global authority</div>
            </div>
            <div class="kpi-card accent-gold">
                <div class="kpi-label">Branch Admins</div>
                <div class="kpi-value gold"><?php echo $branchAdmins; ?></div>
                <div class="kpi-meta">Kaftanasia & Astech scopes</div>
            </div>
        </div>

        <!-- Users Table Panel -->
        <div class="data-panel">
            <div class="data-panel-header">
                <h6><i class="fas fa-users-gear me-2 text-primary"></i>System Personnel Directory (<?php echo $totalUsers; ?>)</h6>
                <span class="text-muted small">Updated live</span>
            </div>
            <div class="table-responsive">
                <table class="table-modern">
                    <thead>
                        <tr>
                            <th>User Name</th>
                            <th>Email Address</th>
                            <th>Assigned Role</th>
                            <th>Warehouse Scope</th>
                            <th>Status</th>
                            <th>Last Activity</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($users as $u): ?>
                            <tr>
                                <td>
                                    <div class="cell-strong"><?php echo htmlspecialchars($u['full_name']); ?></div>
                                    <?php if (!empty($u['username'])): ?>
                                        <div class="cell-muted">@<?php echo htmlspecialchars($u['username']); ?></div>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <span class="font-monospace small text-primary"><?php echo htmlspecialchars($u['email']); ?></span>
                                </td>
                                <td>
                                    <?php if ($u['role'] === 'super_admin'): ?>
                                        <span class="badge-modern badge-purple"><i class="fas fa-shield-alt me-1"></i>Super Admin</span>
                                    <?php elseif ($u['role'] === 'admin_kaftanasia'): ?>
                                        <span class="badge-modern badge-gold"><i class="fas fa-shirt me-1"></i>Kaftanasia Admin</span>
                                    <?php elseif ($u['role'] === 'admin_astech'): ?>
                                        <span class="badge-modern badge-red"><i class="fas fa-laptop me-1"></i>Astech Admin</span>
                                    <?php else: ?>
                                        <span class="badge-modern badge-neutral"><?php echo htmlspecialchars($u['role']); ?></span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if ($u['warehouse_name']): ?>
                                        <span class="badge-modern <?php echo $u['assigned_warehouse_id'] == 1 ? 'badge-gold' : 'badge-red'; ?>">
                                            <i class="fas fa-warehouse me-1"></i><?php echo htmlspecialchars($u['warehouse_name']); ?>
                                        </span>
                                    <?php else: ?>
                                        <span class="badge-modern badge-neutral">
                                            <i class="fas fa-globe me-1"></i>All Warehouses (HQ)
                                        </span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if (!empty($u['is_active'])): ?>
                                        <span class="badge-modern badge-green"><i class="fas fa-check-circle me-1"></i>Active</span>
                                    <?php else: ?>
                                        <span class="badge-modern badge-neutral"><i class="fas fa-ban me-1"></i>Suspended</span>
                                    <?php endif; ?>
                                </td>
                                <td class="cell-muted">
                                    <?php echo !empty($u['last_login']) ? date('d M Y H:i', strtotime($u['last_login'])) : 'Never logged in'; ?>
                                </td>
                                <td style="text-align: right;">
                                    <?php if ($u['id'] != $user['id']): ?>
                                        <div class="d-inline-flex gap-1">
                                            <a href="?toggle=<?php echo $u['id']; ?>" 
                                               class="btn-modern btn-ghost btn-modern-sm <?php echo !empty($u['is_active']) ? 'text-warning' : 'text-success'; ?>" 
                                               title="<?php echo !empty($u['is_active']) ? 'Suspend User Access' : 'Activate User Access'; ?>">
                                                <i class="fas fa-<?php echo !empty($u['is_active']) ? 'ban' : 'check'; ?>"></i>
                                            </a>
                                            <a href="?delete=<?php echo $u['id']; ?>" 
                                               class="btn-modern btn-ghost-danger btn-modern-sm" 
                                               onclick="return confirm('Are you sure you want to permanently delete user <?php echo htmlspecialchars(addslashes($u['full_name'])); ?>?');" 
                                               title="Delete User Account">
                                                <i class="fas fa-trash-alt"></i>
                                            </a>
                                        </div>
                                    <?php else: ?>
                                        <span class="badge-modern badge-neutral">Current Session</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
