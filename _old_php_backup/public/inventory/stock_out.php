<?php
/**
 * Stock Out - Dispatch / Sale / Transfer Inventory
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/roles.php';
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

// Fetch available products based on role/warehouse access
$productSql = "SELECT s.id, s.item_code, s.item_name, s.quantity, s.unit_price, s.selling_price, s.warehouse_id, w.name AS warehouse_name 
               FROM stock_items s 
               JOIN warehouses w ON s.warehouse_id = w.id 
               WHERE s.is_active = 1";
if ($filterWarehouseId) {
    $productSql .= " AND s.warehouse_id = " . (int)$filterWarehouseId;
}
$productSql .= " ORDER BY w.name, s.item_name ASC";
$products = $db->query($productSql)->fetchAll(PDO::FETCH_ASSOC);

$preselectedItemId = isset($_GET['item_id']) ? (int)$_GET['item_id'] : 0;

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $itemId = (int)($_POST['item_id'] ?? 0);
    $qty = (int)($_POST['quantity'] ?? 0);
    $note = trim($_POST['note'] ?? '');
    $destination = trim($_POST['destination'] ?? '');

    if ($itemId <= 0 || $qty <= 0) {
        $error = 'Please select a valid item and enter a quantity greater than 0.';
    } else {
        // Fetch item
        $stmt = $db->prepare("SELECT * FROM stock_items WHERE id = ?");
        $stmt->execute([$itemId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $error = 'Item not found.';
        } elseif (!RolePermissions::canEditWarehouse($currentUserRole, (int)$item['warehouse_id'])) {
            $error = 'Access denied: You cannot dispatch stock from this warehouse.';
        } elseif ($qty > (int)$item['quantity']) {
            $error = "Insufficient stock! Requested {$qty} units, but only {$item['quantity']} units available.";
        } else {
            try {
                $db->beginTransaction();

                $qtyBefore = (int)$item['quantity'];
                $qtyAfter = $qtyBefore - $qty;

                // Update stock item
                $stmt = $db->prepare("
                    UPDATE stock_items 
                    SET quantity = ?, last_movement_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ");
                $stmt->execute([$qtyAfter, $itemId]);

                // Record movement
                $fullNote = ($destination ? "[Customer/Destination: $destination] " : "") . $note;
                $stmt = $db->prepare("
                    INSERT INTO stock_movements 
                        (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
                    VALUES 
                        (?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $item['warehouse_id'],
                    $itemId,
                    $qty,
                    $qtyBefore,
                    $qtyAfter,
                    $item['unit_price'],
                    $item['selling_price'],
                    $fullNote,
                    $user['id'] ?? 1
                ]);

                $db->commit();
                $success = "Successfully dispatched {$qty} units of {$item['item_code']} - {$item['item_name']}. Remaining stock: {$qtyAfter}.";
                
                // Refresh products list
                $products = $db->query($productSql)->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                $db->rollBack();
                $error = 'Transaction error: ' . $e->getMessage();
            }
        }
    }
}

$page_title = 'Stock Out - Dispatch Goods';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?php echo htmlspecialchars($page_title); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="<?php echo htmlspecialchars(app_url('../assets/css/style.css')); ?>">
</head>
<body class="bg-light">

<nav class="navbar navbar-expand-lg navbar-dark bg-dark px-4 shadow-sm">
    <a class="navbar-brand font-weight-bold" href="../dashboard/<?php echo $currentUserRole; ?>.php">
        <i class="fas fa-boxes-stacked text-primary me-2"></i>HQ Inventory System
    </a>
    <div class="ms-auto d-flex align-items-center gap-3">
        <span class="badge bg-secondary"><?php echo htmlspecialchars($user['full_name']); ?> (<?php echo $currentUserRole; ?>)</span>
        <a href="../products/index.php" class="btn btn-outline-light btn-sm"><i class="fas fa-box me-1"></i>Products</a>
        <a href="../dashboard/<?php echo $currentUserRole; ?>.php" class="btn btn-outline-light btn-sm"><i class="fas fa-home me-1"></i>Dashboard</a>
    </div>
</nav>

<div class="container py-4" style="max-width: 800px;">
    <div class="card shadow-sm border-0">
        <div class="card-header bg-danger text-white py-3">
            <h5 class="mb-0 font-weight-bold"><i class="fas fa-arrow-up me-2"></i>Stock Out / Dispatch Inventory</h5>
        </div>
        <div class="card-body p-4">
            <?php if ($error): ?>
                <div class="alert alert-danger"><i class="fas fa-circle-exclamation me-2"></i><?php echo htmlspecialchars($error); ?></div>
            <?php endif; ?>
            <?php if ($success): ?>
                <div class="alert alert-success"><i class="fas fa-circle-check me-2"></i><?php echo htmlspecialchars($success); ?></div>
            <?php endif; ?>

            <form method="POST">
                <div class="mb-3">
                    <label class="form-label font-weight-bold">Select Product *</label>
                    <select name="item_id" class="form-select select2" required>
                        <option value="">-- Choose Product to Dispatch --</option>
                        <?php foreach ($products as $p): ?>
                            <option value="<?php echo $p['id']; ?>" <?php echo ($preselectedItemId == $p['id']) ? 'selected' : ''; ?>>
                                [<?php echo htmlspecialchars($p['warehouse_name']); ?>] <?php echo htmlspecialchars($p['item_code']); ?> - <?php echo htmlspecialchars($p['item_name']); ?> (In Stock: <?php echo $p['quantity']; ?>)
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label font-weight-bold">Quantity to Dispatch *</label>
                        <input type="number" min="1" name="quantity" class="form-control" required placeholder="e.g. 10">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label font-weight-bold">Customer / Destination</label>
                        <input type="text" name="destination" class="form-control" placeholder="e.g. Order #10492 / Retail Store">
                    </div>
                </div>

                <div class="mb-4">
                    <label class="form-label font-weight-bold">Reference / Reason</label>
                    <textarea name="note" class="form-control" rows="3" placeholder="Sale order number, delivery order, dispatch details..."></textarea>
                </div>

                <div class="d-flex justify-content-between">
                    <a href="../products/index.php" class="btn btn-secondary px-4">Back to Products</a>
                    <button type="submit" class="btn btn-danger px-4 font-weight-bold"><i class="fas fa-minus me-1"></i>Confirm Stock Out</button>
                </div>
            </form>
        </div>
    </div>
</div>

</body>
</html>
