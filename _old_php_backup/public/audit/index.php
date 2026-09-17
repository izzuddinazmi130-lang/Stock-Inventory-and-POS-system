<?php
/**
 * Audit Logs - Super Admin Only
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireRole('super_admin');

$user = SessionManager::getUser();
$db = Database::getInstance()->getConnection();

// Action filter
$actionFilter = trim($_GET['action'] ?? '');
$searchFilter = trim($_GET['q'] ?? '');

$sql = "
    SELECT a.*, 
           u.full_name, 
           u.email, 
           u.role AS user_role, 
           u.assigned_warehouse_id, 
           w.name AS warehouse_name 
    FROM audit_logs a 
    LEFT JOIN users u ON u.id = a.user_id 
    LEFT JOIN warehouses w ON w.id = u.assigned_warehouse_id
    WHERE 1=1
";
$params = [];

if ($actionFilter !== '') {
    $sql .= " AND a.action = ?";
    $params[] = $actionFilter;
}

if ($searchFilter !== '') {
    $sql .= " AND (u.full_name LIKE ? OR u.email LIKE ? OR a.new_values LIKE ?)";
    $likeTerm = '%' . $searchFilter . '%';
    $params[] = $likeTerm;
    $params[] = $likeTerm;
    $params[] = $likeTerm;
}

$sql .= " ORDER BY a.created_at DESC LIMIT 200";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Counts for stat cards
$totalLogsCount = (int)$db->query("SELECT COUNT(*) FROM audit_logs")->fetchColumn();
$loginCount = (int)$db->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'login'")->fetchColumn();
$userActionCount = (int)$db->query("SELECT COUNT(*) FROM audit_logs WHERE action IN ('user_approval', 'user_rejection', 'registration_request')")->fetchColumn();

function renderRoleBadge($role, $data = null) {
    if (!$role && is_array($data)) {
        $role = $data['target_role'] ?? $data['role'] ?? null;
    }
    switch ($role) {
        case 'super_admin':
            return '<span class="badge-modern badge-purple"><i class="fas fa-shield-alt me-1"></i>Super Admin</span>';
        case 'admin_kaftanasia':
            return '<span class="badge-modern badge-gold"><i class="fas fa-shirt me-1"></i>Kaftanasia Admin</span>';
        case 'admin_astech':
            return '<span class="badge-modern badge-red"><i class="fas fa-laptop me-1"></i>Astech Admin</span>';
        default:
            return '<span class="badge-modern badge-neutral"><i class="fas fa-robot me-1"></i>System</span>';
    }
}

function renderWarehouseBadge($role, $warehouseName, $warehouseId, $data = null) {
    if (!$warehouseId && is_array($data)) {
        $warehouseId = $data['warehouse_id'] ?? null;
    }
    if ($role === 'super_admin') {
        return '<span class="badge-modern badge-neutral"><i class="fas fa-globe me-1"></i>HQ (All Warehouses)</span>';
    }
    if ($warehouseId == 1 || stripos($warehouseName ?? '', 'kaftan') !== false) {
        return '<span class="badge-modern badge-gold"><i class="fas fa-warehouse me-1"></i>Kaftanasia</span>';
    }
    if ($warehouseId == 2 || stripos($warehouseName ?? '', 'astech') !== false) {
        return '<span class="badge-modern badge-red"><i class="fas fa-warehouse me-1"></i>Astech</span>';
    }
    if (!empty($warehouseName)) {
        return '<span class="badge-modern badge-neutral">' . htmlspecialchars($warehouseName) . '</span>';
    }
    return '<span class="badge-modern badge-neutral">Global</span>';
}

function renderActionBadge($action) {
    switch ($action) {
        case 'login':
            return '<span class="badge-modern badge-blue"><i class="fas fa-sign-in-alt me-1"></i>LOGIN</span>';
        case 'logout':
            return '<span class="badge-modern badge-neutral"><i class="fas fa-sign-out-alt me-1"></i>LOGOUT</span>';
        case 'user_approval':
            return '<span class="badge-modern badge-green"><i class="fas fa-user-check me-1"></i>APPROVED</span>';
        case 'user_rejection':
            return '<span class="badge-modern badge-red"><i class="fas fa-user-times me-1"></i>REJECTED</span>';
        case 'registration_request':
            return '<span class="badge-modern badge-gold"><i class="fas fa-user-clock me-1"></i>REGISTERED</span>';
        case 'stock_in':
            return '<span class="badge-modern badge-green"><i class="fas fa-arrow-down me-1"></i>STOCK IN</span>';
        case 'stock_out':
            return '<span class="badge-modern badge-red"><i class="fas fa-arrow-up me-1"></i>STOCK OUT</span>';
        case 'item_create':
            return '<span class="badge-modern badge-blue"><i class="fas fa-plus me-1"></i>ITEM CREATED</span>';
        default:
            return '<span class="badge-modern badge-neutral">' . htmlspecialchars(strtoupper(str_replace('_', ' ', $action))) . '</span>';
    }
}

function renderLogDetails($log, $data) {
    $action = $log['action'] ?? '';
    
    if (is_array($data)) {
        if (!empty($data['description'])) {
            return htmlspecialchars($data['description']);
        }
        if ($action === 'user_approval') {
            $email = $data['target_email'] ?? 'User';
            $roleLabel = RolePermissions::getRoleLabel($data['target_role'] ?? '');
            return 'Approved user account for <strong class="text-white">' . htmlspecialchars($email) . '</strong> (' . htmlspecialchars($roleLabel) . ')';
        }
        if ($action === 'user_rejection') {
            $email = $data['target_email'] ?? 'User';
            return 'Rejected registration request for <strong class="text-white">' . htmlspecialchars($email) . '</strong>';
        }
        if ($action === 'registration_request') {
            $email = $data['email'] ?? ($data['target_email'] ?? 'User');
            $roleLabel = RolePermissions::getRoleLabel($data['role'] ?? ($data['target_role'] ?? ''));
            return 'Registration submitted for <strong class="text-white">' . htmlspecialchars($email) . '</strong> (' . htmlspecialchars($roleLabel) . ')';
        }
        if ($action === 'stock_in' || $action === 'stock_out') {
            $qty = $data['quantity'] ?? $data['qty'] ?? '';
            $item = $data['item_name'] ?? $data['item_code'] ?? '';
            return ucfirst(str_replace('_', ' ', $action)) . ' of <strong class="text-white">' . htmlspecialchars((string)$qty) . ' units</strong>' . ($item ? ' (' . htmlspecialchars($item) . ')' : '');
        }
        
        $parts = [];
        foreach ($data as $k => $v) {
            if (is_scalar($v) && $v !== '') {
                $parts[] = '<span class="text-muted">' . htmlspecialchars(ucfirst(str_replace('_', ' ', $k))) . ':</span> <strong class="text-white">' . htmlspecialchars((string)$v) . '</strong>';
            }
        }
        if (!empty($parts)) {
            return implode(' &bull; ', $parts);
        }
    }
    
    if ($action === 'login') {
        return 'User logged into the management system';
    }
    if ($action === 'logout') {
        return 'User logged out of active session';
    }
    if (!empty($log['entity_type'])) {
        return ucfirst(htmlspecialchars($log['entity_type'])) . ($log['entity_id'] ? ' #' . htmlspecialchars((string)$log['entity_id']) : '');
    }
    return '<span class="text-muted fst-italic">Activity logged successfully</span>';
}

$page_title = 'System Audit Logs — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>System Audit Trail & History</h2>
                <p class="subtitle">Immutable record of logins, administrative authorizations, and inventory transactions</p>
            </div>
            <div class="header-actions">
                <a href="index.php" class="btn-modern btn-ghost">
                    <i class="fas fa-sync-alt"></i> Reset Filters
                </a>
                <a href="../products/index.php" class="btn-modern btn-ghost">
                    <i class="fas fa-boxes-stacked"></i> View Inventory
                </a>
            </div>
        </div>

        <!-- Quick Stats -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Total Recorded Logs</div>
                <div class="kpi-value"><?php echo number_format($totalLogsCount); ?></div>
                <div class="kpi-meta">Immutable historical records</div>
            </div>
            <div class="kpi-card accent-indigo">
                <div class="kpi-label">Portal Logins</div>
                <div class="kpi-value"><?php echo number_format($loginCount); ?></div>
                <div class="kpi-meta">Successful user authentications</div>
            </div>
            <div class="kpi-card accent-green">
                <div class="kpi-label">Account Management Events</div>
                <div class="kpi-value green"><?php echo number_format($userActionCount); ?></div>
                <div class="kpi-meta">Approvals & user registrations</div>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="filter-panel-modern">
            <form method="GET" action="index.php" class="row g-3 align-items-center">
                <div class="col-md-5">
                    <label class="form-label-modern">Search Details</label>
                    <input type="text" name="q" class="form-control form-control-modern w-100" 
                           placeholder="Search by officer name, email, or activity details..." 
                           value="<?php echo htmlspecialchars($searchFilter); ?>">
                </div>
                <div class="col-md-4">
                    <label class="form-label-modern">Action Type</label>
                    <select name="action" class="form-select form-select-modern w-100">
                        <option value="">-- All Action Types --</option>
                        <option value="login" <?php echo $actionFilter === 'login' ? 'selected' : ''; ?>>Login</option>
                        <option value="logout" <?php echo $actionFilter === 'logout' ? 'selected' : ''; ?>>Logout</option>
                        <option value="user_approval" <?php echo $actionFilter === 'user_approval' ? 'selected' : ''; ?>>User Approval</option>
                        <option value="user_rejection" <?php echo $actionFilter === 'user_rejection' ? 'selected' : ''; ?>>User Rejection</option>
                        <option value="registration_request" <?php echo $actionFilter === 'registration_request' ? 'selected' : ''; ?>>Registration Request</option>
                        <option value="stock_in" <?php echo $actionFilter === 'stock_in' ? 'selected' : ''; ?>>Stock In</option>
                        <option value="stock_out" <?php echo $actionFilter === 'stock_out' ? 'selected' : ''; ?>>Stock Out</option>
                    </select>
                </div>
                <div class="col-md-3 d-flex gap-2 align-self-end">
                    <button type="submit" class="btn-modern btn-primary-dark w-100 justify-content-center">
                        <i class="fas fa-filter me-1"></i> Filter
                    </button>
                    <?php if ($actionFilter || $searchFilter): ?>
                        <a href="index.php" class="btn-modern btn-ghost" title="Clear Filters">
                            <i class="fas fa-times"></i>
                        </a>
                    <?php endif; ?>
                </div>
            </form>
        </div>

        <!-- Logs Table Panel -->
        <div class="data-panel">
            <div class="data-panel-header">
                <h6><i class="fas fa-clock-rotate-left me-2 text-primary"></i>Audit Log Entries (<?php echo count($logs); ?>)</h6>
                <span class="text-muted small">Showing most recent activities</span>
            </div>
            <div class="table-responsive">
                <table class="table-modern">
                    <thead>
                        <tr>
                            <th style="width: 170px;">Timestamp</th>
                            <th style="width: 220px;">User / Officer</th>
                            <th style="width: 160px;">Role</th>
                            <th style="width: 190px;">Warehouse</th>
                            <th style="width: 130px;">Action</th>
                            <th>Activity Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($logs)): ?>
                            <tr>
                                <td colspan="6" class="empty-state">
                                    <i class="fas fa-history fa-3x d-block"></i>
                                    No audit log records found matching the specified search criteria.
                                </td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($logs as $log): ?>
                                <?php
                                    $parsedData = !empty($log['new_values']) ? json_decode($log['new_values'], true) : null;
                                    $userRole = $log['user_role'] ?? null;
                                    $whName = $log['warehouse_name'] ?? null;
                                    $whId = $log['assigned_warehouse_id'] ?? null;
                                ?>
                                <tr>
                                    <td class="cell-muted small">
                                        <div class="cell-strong text-white"><?php echo date('d M Y', strtotime($log['created_at'])); ?></div>
                                        <div class="small text-secondary"><?php echo date('h:i:s A', strtotime($log['created_at'])); ?></div>
                                    </td>
                                    <td>
                                        <div class="cell-strong"><?php echo htmlspecialchars($log['full_name'] ?? 'System / Automated'); ?></div>
                                        <?php if (!empty($log['email'])): ?>
                                            <div class="small text-muted"><?php echo htmlspecialchars($log['email']); ?></div>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <?php echo renderRoleBadge($userRole, $parsedData); ?>
                                    </td>
                                    <td>
                                        <?php echo renderWarehouseBadge($userRole, $whName, $whId, $parsedData); ?>
                                    </td>
                                    <td>
                                        <?php echo renderActionBadge($log['action']); ?>
                                    </td>
                                    <td>
                                        <div class="cell-muted" style="font-size: 13px; color: var(--text-primary);">
                                            <?php echo renderLogDetails($log, $parsedData); ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
            <div class="p-3 border-top border-dark d-flex justify-content-between align-items-center text-muted small" style="background: var(--bg-surface);">
                <span>Showing up to 200 most recent records</span>
                <span>HQ Security & Compliance Trail</span>
            </div>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
