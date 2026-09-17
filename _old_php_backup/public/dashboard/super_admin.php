<?php
// public/dashboard/super_admin.php - Super Admin Dashboard (Sees BOTH warehouses)
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();

// Strict Role Check
if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'super_admin') {
    header('Location: ' . app_url('login.php'));
    exit;
}

$db = Database::getInstance()->getConnection();
$user = SessionManager::getUser();

// Metrics across both warehouses
$stmt = $db->query("
    SELECT 
        w.id as warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        COUNT(DISTINCT si.id) as total_products,
        COALESCE(SUM(si.quantity), 0) as total_stock,
        COALESCE(SUM(si.quantity * si.selling_price), 0) as total_value
    FROM warehouses w
    LEFT JOIN stock_items si ON si.warehouse_id = w.id AND si.is_active = 1
    GROUP BY w.id
");
$warehouseMetrics = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Overall stock threshold counts
$stmt = $db->query("
    SELECT 
        COUNT(CASE WHEN quantity <= 0 THEN 1 END) as out_of_stock,
        COUNT(CASE WHEN quantity > 0 AND quantity <= minimum_quantity THEN 1 END) as low_stock,
        COUNT(CASE WHEN quantity > minimum_quantity THEN 1 END) as normal_stock,
        COALESCE(SUM(quantity), 0) as total_units,
        COUNT(*) as total_items
    FROM stock_items
    WHERE is_active = 1
");
$overallStock = $stmt->fetch(PDO::FETCH_ASSOC);

// Recent Transactions
$stmt = $db->query("
    SELECT 
        m.*,
        w.name as warehouse_name,
        i.item_code,
        i.item_name,
        i.category
    FROM stock_movements m
    JOIN warehouses w ON m.warehouse_id = w.id
    JOIN stock_items i ON m.item_id = i.id
    ORDER BY m.id DESC
    LIMIT 10
");
$recentTransactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = "Super Admin Dashboard";
require_once __DIR__ . '/../layout/header.php';
?>

<style>
/* ============================================================
   SUPER ADMIN DASHBOARD — MODERN MINIMALIST THEME
   Red / Green / Black gradient accents
   ============================================================ */

:root {
    --bg-base:        #0a0a0a;
    --bg-surface:     #141414;
    --bg-elevated:    #1c1c1c;
    --border-subtle:  #2a2a2a;
    --border-strong:  #3a3a3a;

    --text-primary:   #f5f5f5;
    --text-secondary: #a3a3a3;
    --text-muted:     #6b6b6b;

    --accent-red:     #ef4444;
    --accent-green:   #22c55e;
    --accent-black:   #000000;

    --gradient-brand: linear-gradient(135deg, #ef4444 0%, #0a0a0a 50%, #22c55e 100%);
    --gradient-red:   linear-gradient(135deg, #ef4444, #b91c1c);
    --gradient-green: linear-gradient(135deg, #22c55e, #15803d);
    --gradient-dark:  linear-gradient(135deg, #1c1c1c, #0a0a0a);

    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;

    --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.6);

    --transition: 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Page background */
body {
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
}

/* ---------- Layout ---------- */
.main-wrapper {
    min-height: 100vh;
    background: var(--bg-base);
}

.content-area {
    background: var(--bg-base);
    padding: 32px 40px !important;
}

@media (max-width: 768px) {
    .content-area { padding: 20px 16px !important; }
}

/* ---------- Page Header ---------- */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border-subtle);
}

.page-header h2 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0 0 4px 0;
}

.page-header .subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
}

.page-header .header-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
}

/* ---------- Buttons ---------- */
.btn-modern {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    text-decoration: none;
    transition: all var(--transition);
    white-space: nowrap;
}

.btn-modern.btn-primary-dark {
    background: var(--gradient-red);
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);
}
.btn-modern.btn-primary-dark:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    color: #ffffff;
}

.btn-modern.btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border-color: var(--border-strong);
}
.btn-modern.btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
    background: var(--bg-elevated);
}

/* ---------- Section Titles ---------- */
.section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 10px;
}
.section-title::before {
    content: '';
    width: 3px;
    height: 14px;
    background: var(--gradient-brand);
    border-radius: 2px;
}

/* ---------- KPI Cards ---------- */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
}

@media (max-width: 992px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 576px) {
    .kpi-grid { grid-template-columns: 1fr; }
}

.kpi-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 20px 22px;
    position: relative;
    overflow: hidden;
    transition: all var(--transition);
}

.kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--gradient-brand);
    opacity: 0.7;
}

.kpi-card:hover {
    border-color: var(--border-strong);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.kpi-card.accent-green::before {
    background: var(--gradient-green);
}
.kpi-card.accent-red::before {
    background: var(--gradient-red);
}

.kpi-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 10px;
}

.kpi-value {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 8px;
}

.kpi-value.green { color: var(--accent-green); }
.kpi-value.red   { color: var(--accent-red); }

.kpi-meta {
    font-size: 12px;
    color: var(--text-secondary);
}

/* ---------- Warehouse Cards ---------- */
.warehouse-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 32px;
}

@media (max-width: 992px) {
    .warehouse-grid { grid-template-columns: 1fr; }
}

.warehouse-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 24px;
    position: relative;
    overflow: hidden;
    transition: all var(--transition);
}

.warehouse-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 3px;
    background: var(--gradient-red);
}
.warehouse-card.green::before {
    background: var(--gradient-green);
}

.warehouse-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
}

.warehouse-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
}

.warehouse-name {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin: 0 0 6px 0;
}

.warehouse-tag {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    padding: 3px 8px;
    border-radius: 4px;
}

.warehouse-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}

.warehouse-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding-top: 18px;
    border-top: 1px solid var(--border-subtle);
}

.warehouse-stat {
    text-align: left;
}

.warehouse-stat .stat-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
}

.warehouse-stat .stat-value {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    line-height: 1;
}

.warehouse-stat .stat-value.green { color: var(--accent-green); }

/* ---------- Data Table ---------- */
.data-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.data-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid var(--border-subtle);
}

.data-panel-header h6 {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-primary);
    margin: 0;
}

.data-panel-header a {
    font-size: 12px;
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 500;
    transition: color var(--transition);
}
.data-panel-header a:hover {
    color: var(--accent-green);
}

.table-modern {
    width: 100%;
    border-collapse: collapse;
}

.table-modern thead th {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: left;
    padding: 12px 24px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-subtle);
}

.table-modern tbody td {
    padding: 14px 24px;
    font-size: 13px;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
}

.table-modern tbody tr:last-child td {
    border-bottom: none;
}

.table-modern tbody tr {
    transition: background var(--transition);
}

.table-modern tbody tr:hover {
    background: var(--bg-elevated);
}

.table-modern .cell-muted {
    color: var(--text-muted);
    font-size: 12px;
}

.table-modern .cell-strong {
    font-weight: 600;
}

/* ---------- Badges ---------- */
.badge-modern {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 4px;
    line-height: 1.4;
}

.badge-modern.badge-neutral {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
}

.badge-modern.badge-green {
    background: rgba(34, 197, 94, 0.12);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.25);
}

.badge-modern.badge-red {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.25);
}

/* ---------- Empty State ---------- */
.empty-state {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-muted);
    font-size: 13px;
}

/* ---------- Scrollbar ---------- */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg-base); }
::-webkit-scrollbar-thumb {
    background: var(--border-strong);
    border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
</style>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>Super Admin Overview</h2>
                <p class="subtitle">Centralized control across Kaftanasia and Astech warehouses</p>
            </div>
            <div class="header-actions">
                <a href="<?php echo app_url('products/index.php'); ?>" class="btn-modern btn-primary-dark">
                    View All Stock
                </a>
                <a href="<?php echo app_url('users/index.php'); ?>" class="btn-modern btn-ghost">
                    Manage Users
                </a>
            </div>
        </div>

        <!-- Pending User Approvals Widget -->
        <?php require_once __DIR__ . '/../../includes/partials/pending_widget.php'; ?>

        <!-- KPI Cards -->
        <div class="section-title">Overview</div>
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Total Catalog</div>
                <div class="kpi-value"><?php echo number_format($overallStock['total_items']); ?></div>
                <div class="kpi-meta"><?php echo number_format($overallStock['total_units']); ?> units in stock</div>
            </div>

            <div class="kpi-card accent-green">
                <div class="kpi-label">Healthy Stock</div>
                <div class="kpi-value green"><?php echo number_format($overallStock['normal_stock']); ?></div>
                <div class="kpi-meta">Normal inventory levels</div>
            </div>

            <div class="kpi-card accent-red">
                <div class="kpi-label">Low Stock</div>
                <div class="kpi-value red"><?php echo number_format($overallStock['low_stock']); ?></div>
                <div class="kpi-meta">Requires reorder</div>
            </div>

            <div class="kpi-card accent-red">
                <div class="kpi-label">Out of Stock</div>
                <div class="kpi-value red"><?php echo number_format($overallStock['out_of_stock']); ?></div>
                <div class="kpi-meta">Zero quantity</div>
            </div>
        </div>

        <!-- Warehouses -->
        <div class="section-title">Managed Warehouses</div>
        <div class="warehouse-grid">
            <?php foreach ($warehouseMetrics as $wh): ?>
                <?php $is_green = $wh['warehouse_id'] == 1; ?>
                <div class="warehouse-card <?php echo $is_green ? 'green' : ''; ?>">
                    <div class="warehouse-header">
                        <div>
                            <h3 class="warehouse-name"><?php echo htmlspecialchars($wh['warehouse_name']); ?></h3>
                            <span class="warehouse-tag">
                                ID <?php echo $wh['warehouse_id']; ?> &middot; <?php echo htmlspecialchars($wh['warehouse_code']); ?>
                            </span>
                        </div>
                        <div class="warehouse-actions">
                            <a href="<?php echo app_url('dashboard/' . ($wh['warehouse_id'] == 1 ? 'admin_kaftanasia.php' : 'admin_astech.php')); ?>"
                               class="btn-modern <?php echo $is_green ? 'btn-primary-dark' : 'btn-primary-dark'; ?>"
                               style="<?php echo $is_green ? 'background: var(--gradient-green); box-shadow: 0 4px 14px rgba(34,197,94,0.25);' : ''; ?>">
                                Open
                            </a>
                            <a href="<?php echo app_url('products/index.php?warehouse=' . $wh['warehouse_id']); ?>"
                               class="btn-modern btn-ghost">
                                Stock
                            </a>
                        </div>
                    </div>

                    <div class="warehouse-stats">
                        <div class="warehouse-stat">
                            <div class="stat-label">Products</div>
                            <div class="stat-value"><?php echo number_format($wh['total_products']); ?></div>
                        </div>
                        <div class="warehouse-stat">
                            <div class="stat-label">Total Stock</div>
                            <div class="stat-value"><?php echo number_format($wh['total_stock']); ?></div>
                        </div>
                        <div class="warehouse-stat">
                            <div class="stat-label">Stock Value</div>
                            <div class="stat-value green">RM <?php echo number_format($wh['total_value'], 2); ?></div>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <!-- Recent Movements -->
        <div class="section-title">Recent Activity</div>
        <div class="data-panel">
            <div class="data-panel-header">
                <h6>Recent Stock Movements</h6>
                <a href="<?php echo app_url('reports/index.php'); ?>">View Full Reports &rarr;</a>
            </div>

            <div class="table-responsive">
                <table class="table-modern">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Warehouse</th>
                            <th>Item</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Before &rarr; After</th>
                            <th>Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($recentTransactions)): ?>
                            <tr>
                                <td colspan="7" class="empty-state">
                                    No stock movements recorded yet.
                                </td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($recentTransactions as $tx): ?>
                                <tr>
                                    <td class="cell-muted"><?php echo htmlspecialchars($tx['created_at']); ?></td>
                                    <td>
                                        <span class="badge-modern badge-neutral">
                                            <?php echo htmlspecialchars($tx['warehouse_name']); ?>
                                        </span>
                                    </td>
                                    <td>
                                        <div class="cell-strong"><?php echo htmlspecialchars($tx['item_code']); ?></div>
                                        <div class="cell-muted"><?php echo htmlspecialchars($tx['item_name']); ?></div>
                                    </td>
                                    <td>
                                        <span class="badge-modern <?php echo $tx['movement_type'] === 'in' ? 'badge-green' : 'badge-red'; ?>">
                                            <?php echo strtoupper($tx['movement_type']); ?>
                                        </span>
                                    </td>
                                    <td class="cell-strong"><?php echo $tx['quantity']; ?></td>
                                    <td class="cell-muted"><?php echo $tx['qty_before']; ?> &rarr; <?php echo $tx['qty_after']; ?></td>
                                    <td class="cell-muted"><?php echo htmlspecialchars($tx['note'] ?: '—'); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </main>
</div>

</body>
</html>