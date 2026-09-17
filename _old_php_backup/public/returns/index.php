<?php
/**
 * Returns & Damage Management - Role-Isolated
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

// Determine warehouse filter
$filterWarehouseId = null;
if ($currentUserRole !== 'super_admin') {
    $filterWarehouseId = $userWarehouseId;
} elseif (isset($_GET['warehouse']) && in_array((int)$_GET['warehouse'], [1, 2])) {
    $filterWarehouseId = (int)$_GET['warehouse'];
}

// Available products
$productSql = "SELECT s.id, s.item_code, s.item_name, s.quantity, s.warehouse_id, w.name AS warehouse_name 
               FROM stock_items s 
               JOIN warehouses w ON s.warehouse_id = w.id 
               WHERE s.is_active = 1";
if ($filterWarehouseId) {
    $productSql .= " AND s.warehouse_id = " . (int)$filterWarehouseId;
}
$productSql .= " ORDER BY w.name, s.item_name ASC";
$products = $db->query($productSql)->fetchAll(PDO::FETCH_ASSOC);

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $itemId = (int)($_POST['item_id'] ?? 0);
    $recordType = $_POST['record_type'] ?? '';
    $qty = (int)($_POST['qty'] ?? 0);
    $note = trim($_POST['note'] ?? '');

    if ($itemId <= 0 || $qty <= 0 || !in_array($recordType, ['return', 'damage'])) {
        $error = 'Invalid submission. Please select item, record type (return or damage), and positive quantity.';
    } else {
        $stmt = $db->prepare("SELECT * FROM stock_items WHERE id = ?");
        $stmt->execute([$itemId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $error = 'Item not found.';
        } elseif (!RolePermissions::canEditWarehouse($currentUserRole, (int)$item['warehouse_id'])) {
            $error = 'Access denied: You cannot modify stock for this warehouse.';
        } else {
            try {
                $db->beginTransaction();

                $qtyBefore = (int)$item['quantity'];
                // Return adds back to inventory, Damage writes off / reduces inventory
                if ($recordType === 'return') {
                    $qtyAfter = $qtyBefore + $qty;
                } else {
                    if ($qty > $qtyBefore) {
                        throw new Exception("Cannot report damage of {$qty} units when only {$qtyBefore} exist in stock.");
                    }
                    $qtyAfter = $qtyBefore - $qty;
                }

                // Update stock item
                $stmt = $db->prepare("
                    UPDATE stock_items 
                    SET quantity = ?, last_movement_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ");
                $stmt->execute([$qtyAfter, $itemId]);

                // Insert into stock_returns_damage
                $stmt = $db->prepare("
                    INSERT INTO stock_returns_damage 
                        (warehouse_id, item_id, record_type, qty, qty_before, qty_after, note, performed_by, created_at)
                    VALUES 
                        (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $item['warehouse_id'],
                    $itemId,
                    $recordType,
                    $qty,
                    $qtyBefore,
                    $qtyAfter,
                    $note,
                    $user['id'] ?? 1
                ]);

                // Also log into stock_movements for audit trail
                $movementType = ($recordType === 'return') ? 'in' : 'out';
                $stmt = $db->prepare("
                    INSERT INTO stock_movements 
                        (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
                    VALUES 
                        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $item['warehouse_id'],
                    $itemId,
                    $movementType,
                    $qty,
                    $qtyBefore,
                    $qtyAfter,
                    $item['unit_price'],
                    $item['selling_price'],
                    "[{$recordType}] " . $note,
                    $user['id'] ?? 1
                ]);

                $db->commit();
                $success = "Successfully logged " . strtoupper($recordType) . " of {$qty} units for SKU {$item['item_code']}. New stock balance: {$qtyAfter}.";
            } catch (Exception $e) {
                $db->rollBack();
                $error = $e->getMessage();
            }
        }
    }
}

// Fetch recent return/damage records
$recordsSql = "
    SELECT r.*, s.item_code, s.item_name, w.name AS warehouse_name, u.full_name AS performed_by_name
    FROM stock_returns_damage r
    JOIN stock_items s ON r.item_id = s.id
    JOIN warehouses w ON r.warehouse_id = w.id
    LEFT JOIN users u ON r.performed_by = u.id
";
if ($filterWarehouseId) {
    $recordsSql .= " WHERE r.warehouse_id = " . (int)$filterWarehouseId;
}
$recordsSql .= " ORDER BY r.created_at DESC LIMIT 50";
$records = $db->query($recordsSql)->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Returns & Damage Management — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>Returns & Damage Operations</h2>
                <p class="subtitle">Record customer returns back to inventory or write off damaged / defective stock</p>
            </div>
            <div class="header-actions">
                <a href="../products/index.php" class="btn-modern btn-ghost">
                    <i class="fas fa-boxes-stacked"></i> All Products
                </a>
                <a href="../reports/movement_report.php" class="btn-modern btn-ghost">
                    <i class="fas fa-chart-line"></i> Movement Reports
                </a>
            </div>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-danger bg-danger text-white border-0 mb-4">
                <i class="fas fa-exclamation-circle me-2"></i><?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>

        <?php if ($success): ?>
            <div class="alert alert-success bg-success text-white border-0 mb-4">
                <i class="fas fa-check-circle me-2"></i><?php echo htmlspecialchars($success); ?>
            </div>
        <?php endif; ?>

        <div class="row g-4">
            <!-- Left Form Panel -->
            <div class="col-lg-5">
                <div class="data-panel mb-0">
                    <div class="data-panel-header">
                        <h6><i class="fas fa-pen-to-square me-2 text-primary"></i>Record Transaction</h6>
                    </div>
                    <div class="p-4" style="background: var(--bg-surface);">
                        <form method="POST">
                            <div class="mb-3">
                                <label class="form-label-modern">Target Inventory Item *</label>
                                <select name="item_id" class="form-select form-select-modern w-100" required>
                                    <option value="">-- Select Product --</option>
                                    <?php foreach ($products as $p): ?>
                                        <option value="<?php echo $p['id']; ?>">
                                            [<?php echo htmlspecialchars($p['warehouse_name']); ?>] <?php echo htmlspecialchars($p['item_code']); ?> - <?php echo htmlspecialchars($p['item_name']); ?> (In Stock: <?php echo $p['quantity']; ?>)
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label class="form-label-modern">Operation Type *</label>
                                <select name="record_type" class="form-select form-select-modern w-100" required>
                                    <option value="return">Customer / Vendor Return (+ Restocks item)</option>
                                    <option value="damage">Damaged / Defect Write-off (- Deducts item)</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label class="form-label-modern">Quantity *</label>
                                <input type="number" min="1" name="qty" class="form-control form-control-modern w-100" required placeholder="e.g. 1">
                            </div>

                            <div class="mb-4">
                                <label class="form-label-modern">Reason & Note *</label>
                                <textarea name="note" class="form-control form-control-modern w-100" rows="3" required placeholder="Describe reason (e.g. customer exchange, broken screen, torn stitching, shipping defect)..."></textarea>
                            </div>

                            <button type="submit" class="btn-modern btn-primary-dark w-100 justify-content-center py-2">
                                <i class="fas fa-check me-1"></i> Submit Transaction
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Right History Table -->
            <div class="col-lg-7">
                <div class="data-panel mb-0 h-100">
                    <div class="data-panel-header">
                        <h6><i class="fas fa-history me-2 text-primary"></i>Recent Records (<?php echo count($records); ?>)</h6>
                        <span class="text-muted small">Latest 50 events</span>
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
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($records)): ?>
                                    <tr>
                                        <td colspan="6" class="empty-state">
                                            <i class="fas fa-receipt fa-3x d-block"></i>
                                            No return or damage entries recorded yet.
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($records as $r): ?>
                                        <tr>
                                            <td class="cell-muted small">
                                                <?php echo date('d M Y H:i', strtotime($r['created_at'])); ?>
                                            </td>
                                            <td>
                                                <span class="badge-modern <?php echo $r['warehouse_id'] == 1 ? 'badge-gold' : 'badge-red'; ?>">
                                                    <?php echo htmlspecialchars($r['warehouse_name']); ?>
                                                </span>
                                            </td>
                                            <td>
                                                <div class="cell-strong font-monospace text-primary"><?php echo htmlspecialchars($r['item_code']); ?></div>
                                                <div class="cell-muted small"><?php echo htmlspecialchars($r['item_name']); ?></div>
                                            </td>
                                            <td>
                                                <?php if ($r['record_type'] === 'return'): ?>
                                                    <span class="badge-modern badge-green"><i class="fas fa-undo me-1"></i>RETURN</span>
                                                <?php else: ?>
                                                    <span class="badge-modern badge-red"><i class="fas fa-triangle-exclamation me-1"></i>DAMAGE</span>
                                                <?php endif; ?>
                                            </td>
                                            <td>
                                                <span class="cell-strong <?php echo $r['record_type'] === 'return' ? 'text-success' : 'text-danger'; ?>">
                                                    <?php echo ($r['record_type'] === 'return' ? '+' : '-') . (int)$r['qty']; ?>
                                                </span>
                                            </td>
                                            <td class="cell-muted" style="max-width: 200px; font-size: 12px;">
                                                <?php echo htmlspecialchars($r['note']); ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
