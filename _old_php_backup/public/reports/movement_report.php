<?php
/**
 * Movement Report - Role-Based Access Control
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/DataFilter.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireLogin();

$user = SessionManager::getUser();
$currentUserRole = $user['role'];
$userWarehouseId = $user['assigned_warehouse_id'] ?? $user['warehouse_id'] ?? null;

$db = Database::getInstance()->getConnection();

// Date filters
$dateFrom = $_GET['date_from'] ?? date('Y-m-01');
$dateTo = $_GET['date_to'] ?? date('Y-m-d');
$movementType = $_GET['type'] ?? '';

// Determine warehouse filter
$filterWarehouseId = null;
if ($currentUserRole !== 'super_admin') {
    $filterWarehouseId = $userWarehouseId;
} elseif (isset($_GET['warehouse']) && in_array((int)$_GET['warehouse'], [1, 2])) {
    $filterWarehouseId = (int)$_GET['warehouse'];
}

$params = [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59'];
$whereConditions = ["m.created_at BETWEEN ? AND ?"];

if ($filterWarehouseId) {
    $whereConditions[] = "m.warehouse_id = ?";
    $params[] = $filterWarehouseId;
}

if (!empty($movementType)) {
    $whereConditions[] = "m.movement_type = ?";
    $params[] = $movementType;
}

$whereClause = implode(" AND ", $whereConditions);

$query = "
    SELECT m.*, s.item_code, s.item_name, w.name AS warehouse_name, u.full_name AS performed_by_name
    FROM stock_movements m
    JOIN stock_items s ON m.item_id = s.id
    JOIN warehouses w ON m.warehouse_id = w.id
    LEFT JOIN users u ON m.performed_by = u.id
    WHERE {$whereClause}
    ORDER BY m.created_at DESC
";

$stmt = $db->prepare($query);
$stmt->execute($params);
$movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Summaries
$summaryIn = 0;
$summaryOut = 0;
$totalTransactions = count($movements);

foreach ($movements as $m) {
    if ($m['movement_type'] === 'in') {
        $summaryIn += (int)$m['quantity'];
    } elseif ($m['movement_type'] === 'out') {
        $summaryOut += (int)$m['quantity'];
    }
}

$page_title = 'Inventory Movement Report — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>Stock Movement & Flow Reports</h2>
                <p class="subtitle">Complete audit logs of inbound deliveries, customer dispatches, and warehouse adjustments</p>
            </div>
            <div class="header-actions">
                <button onclick="window.print()" class="btn-modern btn-ghost">
                    <i class="fas fa-print"></i> Print Report
                </button>
                <a href="../products/index.php" class="btn-modern btn-ghost">
                    <i class="fas fa-boxes-stacked"></i> View Inventory
                </a>
            </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Recorded Transactions</div>
                <div class="kpi-value"><?php echo number_format($totalTransactions); ?></div>
                <div class="kpi-meta">Across filtered period</div>
            </div>
            <div class="kpi-card accent-green">
                <div class="kpi-label">Inbound Volume</div>
                <div class="kpi-value green">+<?php echo number_format($summaryIn); ?></div>
                <div class="kpi-meta">Units restocked into warehouses</div>
            </div>
            <div class="kpi-card accent-red">
                <div class="kpi-label">Outbound Volume</div>
                <div class="kpi-value red">-<?php echo number_format($summaryOut); ?></div>
                <div class="kpi-meta">Units shipped / written off</div>
            </div>
            <div class="kpi-card accent-indigo">
                <div class="kpi-label">Net Inventory Delta</div>
                <div class="kpi-value <?php echo ($summaryIn >= $summaryOut) ? 'green' : 'red'; ?>">
                    <?php echo ($summaryIn >= $summaryOut ? '+' : '') . number_format($summaryIn - $summaryOut); ?>
                </div>
                <div class="kpi-meta">Net change in stock units</div>
            </div>
        </div>

        <!-- Filter Form Toolbar -->
        <div class="filter-panel-modern">
            <form method="GET" class="row g-3 align-items-end">
                <?php if ($currentUserRole === 'super_admin'): ?>
                    <div class="col-md-3">
                        <label class="form-label-modern">Target Warehouse</label>
                        <select name="warehouse" class="form-select form-select-modern">
                            <option value="">All Warehouses</option>
                            <option value="1" <?php echo ($filterWarehouseId == 1) ? 'selected' : ''; ?>>Kaftanasia (Clothing)</option>
                            <option value="2" <?php echo ($filterWarehouseId == 2) ? 'selected' : ''; ?>>Astech (Computers)</option>
                        </select>
                    </div>
                <?php endif; ?>

                <div class="col-md-2">
                    <label class="form-label-modern">Movement Type</label>
                    <select name="type" class="form-select form-select-modern">
                        <option value="">All Types</option>
                        <option value="in" <?php echo ($movementType === 'in') ? 'selected' : ''; ?>>Stock In</option>
                        <option value="out" <?php echo ($movementType === 'out') ? 'selected' : ''; ?>>Stock Out</option>
                        <option value="adjust" <?php echo ($movementType === 'adjust') ? 'selected' : ''; ?>>Adjustment</option>
                    </select>
                </div>

                <div class="col-md-2">
                    <label class="form-label-modern">Start Date</label>
                    <input type="date" name="date_from" class="form-control form-control-modern" value="<?php echo htmlspecialchars($dateFrom); ?>">
                </div>

                <div class="col-md-2">
                    <label class="form-label-modern">End Date</label>
                    <input type="date" name="date_to" class="form-control form-control-modern" value="<?php echo htmlspecialchars($dateTo); ?>">
                </div>

                <div class="col-md-3 d-flex gap-2">
                    <button type="submit" class="btn-modern btn-primary-dark w-100 justify-content-center">
                        <i class="fas fa-filter me-1"></i> Apply Filter
                    </button>
                    <a href="movement_report.php" class="btn-modern btn-ghost">
                        Reset
                    </a>
                </div>
            </form>
        </div>

        <!-- Movements Table Panel -->
        <div class="data-panel">
            <div class="data-panel-header">
                <h6><i class="fas fa-table-list me-2 text-primary"></i>Movement Ledger Entries (<?php echo number_format($totalTransactions); ?>)</h6>
                <span class="text-muted small">Chronological order</span>
            </div>
            <div class="table-responsive">
                <table class="table-modern">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Warehouse</th>
                            <th>SKU Code</th>
                            <th>Product Name</th>
                            <th>Type</th>
                            <th>Quantity</th>
                            <th>Stock Progression</th>
                            <th>Officer</th>
                            <th>Reference / Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($movements)): ?>
                            <tr>
                                <td colspan="9" class="empty-state">
                                    <i class="fas fa-chart-line fa-3x d-block"></i>
                                    No stock movement records found matching the specified parameters.
                                </td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($movements as $m): ?>
                                <tr>
                                    <td class="cell-muted small">
                                        <?php echo date('d M Y H:i:s', strtotime($m['created_at'])); ?>
                                    </td>
                                    <td>
                                        <span class="badge-modern <?php echo $m['warehouse_id'] == 1 ? 'badge-gold' : 'badge-red'; ?>">
                                            <?php echo htmlspecialchars($m['warehouse_name']); ?>
                                        </span>
                                    </td>
                                    <td>
                                        <span class="cell-strong font-monospace text-primary"><?php echo htmlspecialchars($m['item_code']); ?></span>
                                    </td>
                                    <td>
                                        <div class="cell-strong"><?php echo htmlspecialchars($m['item_name']); ?></div>
                                    </td>
                                    <td>
                                        <?php if ($m['movement_type'] === 'in'): ?>
                                            <span class="badge-modern badge-green"><i class="fas fa-arrow-down me-1"></i>IN</span>
                                        <?php elseif ($m['movement_type'] === 'out'): ?>
                                            <span class="badge-modern badge-red"><i class="fas fa-arrow-up me-1"></i>OUT</span>
                                        <?php else: ?>
                                            <span class="badge-modern badge-neutral"><i class="fas fa-sliders me-1"></i>ADJUST</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <span class="cell-strong fs-6 <?php echo $m['movement_type'] === 'in' ? 'text-success' : 'text-danger'; ?>">
                                            <?php echo ($m['movement_type'] === 'in' ? '+' : '-') . $m['quantity']; ?>
                                        </span>
                                    </td>
                                    <td class="cell-muted small">
                                        <?php echo $m['qty_before']; ?> &rarr; <span class="cell-strong"><?php echo $m['qty_after']; ?></span>
                                    </td>
                                    <td>
                                        <span class="badge-modern badge-neutral"><?php echo htmlspecialchars($m['performed_by_name'] ?? 'System'); ?></span>
                                    </td>
                                    <td class="cell-muted" style="max-width: 220px; font-size: 12px;">
                                        <?php echo htmlspecialchars($m['note'] ?? '&mdash;'); ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
