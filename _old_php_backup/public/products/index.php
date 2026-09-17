<?php
/**
 * Product List - Role-Based Access Control
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

// Determine warehouse filter
$filterWarehouseId = DataFilter::getWarehouseFilter($currentUserRole, $userWarehouseId);

$db = Database::getInstance()->getConnection();

$search = trim($_GET['search'] ?? '');
$selectedWarehouse = isset($_GET['warehouse']) ? (int)$_GET['warehouse'] : null;

// Build query
$whereConditions = ["s.is_active = 1"];
$params = [];

if ($filterWarehouseId !== null) {
    $whereConditions[] = "s.warehouse_id = ?";
    $params[] = $filterWarehouseId;
} elseif ($selectedWarehouse && in_array($selectedWarehouse, [1, 2])) {
    $whereConditions[] = "s.warehouse_id = ?";
    $params[] = $selectedWarehouse;
}

if ($search !== '') {
    $whereConditions[] = "(s.item_code LIKE ? OR s.item_name LIKE ? OR s.category LIKE ?)";
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$whereClause = "WHERE " . implode(" AND ", $whereConditions);

$query = "
    SELECT s.*, w.name AS warehouse_name
    FROM stock_items s
    JOIN warehouses w ON s.warehouse_id = w.id
    {$whereClause}
    ORDER BY w.name ASC, s.item_code ASC
";

$stmt = $db->prepare($query);
$stmt->execute($params);
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Counts
$totalCount = count($products);

$page_title = 'Product Inventory — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>Product Inventory & Catalog</h2>
                <p class="subtitle">
                    <?php if ($currentUserRole === 'super_admin'): ?>
                        Centralized oversight across Kaftanasia and Astech warehouse locations
                    <?php elseif ($currentUserRole === 'admin_kaftanasia'): ?>
                        Viewing Kaftanasia (Clothing & Apparel) warehouse stock
                    <?php else: ?>
                        Viewing Astech (Computers & Hardware) warehouse stock
                    <?php endif; ?>
                </p>
            </div>
            <div class="header-actions">
                <a href="../inventory/stock_in.php" class="btn-modern btn-success-dark">
                    <i class="fas fa-arrow-down"></i> Stock In
                </a>
                <a href="../inventory/stock_out.php" class="btn-modern btn-ghost-danger">
                    <i class="fas fa-arrow-up"></i> Stock Out
                </a>
                <a href="add.php" class="btn-modern btn-primary-dark">
                    <i class="fas fa-plus"></i> Add Product
                </a>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="filter-panel-modern d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <?php if ($currentUserRole === 'super_admin'): ?>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="text-muted small text-uppercase fw-bold me-1"><i class="fas fa-filter me-1"></i>Warehouse:</span>
                    <a href="index.php<?php echo $search ? '?search=' . urlencode($search) : ''; ?>" 
                       class="btn-modern btn-modern-sm <?php echo !$selectedWarehouse ? 'btn-primary-dark' : 'btn-ghost'; ?>">
                        All Locations
                    </a>
                    <a href="index.php?warehouse=1<?php echo $search ? '&search=' . urlencode($search) : ''; ?>" 
                       class="btn-modern btn-modern-sm <?php echo ($selectedWarehouse === 1) ? 'btn-ghost-warning' : 'btn-ghost'; ?>"
                       style="<?php echo ($selectedWarehouse === 1) ? 'background: #f59e0b; color: #000 !important;' : ''; ?>">
                        <i class="fas fa-shirt me-1"></i> Kaftanasia
                    </a>
                    <a href="index.php?warehouse=2<?php echo $search ? '&search=' . urlencode($search) : ''; ?>" 
                       class="btn-modern btn-modern-sm <?php echo ($selectedWarehouse === 2) ? 'btn-primary-dark' : 'btn-ghost'; ?>">
                        <i class="fas fa-laptop me-1"></i> Astech
                    </a>
                </div>
            <?php else: ?>
                <div class="text-secondary small">
                    <i class="fas fa-warehouse me-1 text-primary"></i>
                    <strong><?php echo $currentUserRole === 'admin_kaftanasia' ? 'Kaftanasia Warehouse' : 'Astech Warehouse'; ?></strong>
                </div>
            <?php endif; ?>

            <form method="GET" action="index.php" class="d-flex align-items-center gap-2 ms-auto" style="min-width: 280px;">
                <?php if ($selectedWarehouse): ?>
                    <input type="hidden" name="warehouse" value="<?php echo $selectedWarehouse; ?>">
                <?php endif; ?>
                <input type="text" name="search" class="form-control form-control-modern form-control-sm" 
                       placeholder="Search SKU, item name..." value="<?php echo htmlspecialchars($search); ?>">
                <button type="submit" class="btn-modern btn-ghost btn-modern-sm">
                    <i class="fas fa-search"></i>
                </button>
                <?php if ($search): ?>
                    <a href="index.php<?php echo $selectedWarehouse ? '?warehouse=' . $selectedWarehouse : ''; ?>" 
                       class="btn-modern btn-ghost btn-modern-sm text-muted" title="Clear Search">
                        <i class="fas fa-times"></i>
                    </a>
                <?php endif; ?>
            </form>
        </div>

        <!-- Products Table Panel -->
        <div class="data-panel">
            <div class="data-panel-header">
                <h6><i class="fas fa-boxes-stacked me-2 text-primary"></i>Inventory Records (<?php echo number_format($totalCount); ?>)</h6>
                <span class="text-muted small">Updated in real-time</span>
            </div>
            <div class="table-responsive">
                <table class="table-modern">
                    <thead>
                        <tr>
                            <th>Warehouse</th>
                            <th>SKU / Code</th>
                            <th>Product Details</th>
                            <th>Category</th>
                            <th>Variant / Specs</th>
                            <th>Unit Cost</th>
                            <th>Selling Price</th>
                            <th>Stock Level</th>
                            <th>Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($products)): ?>
                            <tr>
                                <td colspan="10" class="empty-state">
                                    <i class="fas fa-box-open fa-3x d-block"></i>
                                    No products found matching your filter or search query.
                                </td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($products as $p): ?>
                                <?php
                                $qty = (int)$p['quantity'];
                                $min = (int)$p['minimum_quantity'];
                                $canEdit = RolePermissions::canEditWarehouse($currentUserRole, (int)$p['warehouse_id']);
                                ?>
                                <tr>
                                    <td>
                                        <span class="badge-modern <?php echo $p['warehouse_id'] == 1 ? 'badge-gold' : 'badge-red'; ?>">
                                            <?php echo htmlspecialchars($p['warehouse_name']); ?>
                                        </span>
                                    </td>
                                    <td>
                                        <span class="cell-strong font-monospace text-primary"><?php echo htmlspecialchars($p['item_code']); ?></span>
                                    </td>
                                    <td>
                                        <div class="cell-strong"><?php echo htmlspecialchars($p['item_name']); ?></div>
                                        <?php if (!empty($p['pc_brand']) || !empty($p['pc_model'])): ?>
                                            <div class="cell-muted"><?php echo htmlspecialchars(trim($p['pc_brand'] . ' ' . $p['pc_model'])); ?></div>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <span class="badge-modern badge-neutral"><?php echo htmlspecialchars($p['category']); ?></span>
                                    </td>
                                    <td class="cell-muted">
                                        <?php 
                                        $variant = [];
                                        if (!empty($p['variant_color'])) $variant[] = $p['variant_color'];
                                        if (!empty($p['size'])) $variant[] = 'Size ' . $p['size'];
                                        if (!empty($p['processor'])) $variant[] = $p['processor'];
                                        if (!empty($p['ram'])) $variant[] = $p['ram'];
                                        echo !empty($variant) ? htmlspecialchars(implode(' &bull; ', $variant)) : '&mdash;';
                                        ?>
                                    </td>
                                    <td class="cell-muted">RM <?php echo number_format($p['unit_price'], 2); ?></td>
                                    <td class="cell-strong">RM <?php echo number_format($p['selling_price'], 2); ?></td>
                                    <td>
                                        <span class="cell-strong fs-6"><?php echo $qty; ?></span>
                                    </td>
                                    <td>
                                        <?php if ($qty <= 0): ?>
                                            <span class="badge-modern badge-red"><i class="fas fa-ban me-1"></i>Out of Stock</span>
                                        <?php elseif ($qty <= $min): ?>
                                            <span class="badge-modern badge-gold"><i class="fas fa-exclamation-triangle me-1"></i>Low Stock</span>
                                        <?php else: ?>
                                            <span class="badge-modern badge-green"><i class="fas fa-check-circle me-1"></i>Optimal</span>
                                        <?php endif; ?>
                                    </td>
                                    <td style="text-align: right;">
                                        <?php if ($canEdit): ?>
                                            <div class="d-inline-flex gap-1">
                                                <a href="edit.php?id=<?php echo $p['id']; ?>" class="btn-modern btn-ghost btn-modern-sm" title="Edit Product Details">
                                                    <i class="fas fa-pen"></i>
                                                </a>
                                                <a href="../qr/generate.php?product_id=<?php echo $p['id']; ?>" class="btn-modern btn-ghost btn-modern-sm" title="Generate QR Code">
                                                    <i class="fas fa-qrcode"></i>
                                                </a>
                                                <a href="../inventory/stock_in.php?item_id=<?php echo $p['id']; ?>" class="btn-modern btn-ghost btn-modern-sm text-success" title="Quick Stock In">
                                                    <i class="fas fa-plus"></i>
                                                </a>
                                                <a href="../inventory/stock_out.php?item_id=<?php echo $p['id']; ?>" class="btn-modern btn-ghost btn-modern-sm text-danger" title="Quick Stock Out">
                                                    <i class="fas fa-minus"></i>
                                                </a>
                                            </div>
                                        <?php else: ?>
                                            <span class="text-muted small"><i class="fas fa-lock me-1"></i>Protected</span>
                                        <?php endif; ?>
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
