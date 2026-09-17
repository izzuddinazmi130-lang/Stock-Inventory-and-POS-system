<?php
/**
 * Edit Product - Role-Based Access Control
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/roles.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireLogin();

$user = SessionManager::getUser();
$currentUserRole = $user['role'];
$userWarehouseId = $user['assigned_warehouse_id'] ?? $user['warehouse_id'] ?? null;

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    header('Location: index.php');
    exit;
}

$db = Database::getInstance()->getConnection();

$stmt = $db->prepare("SELECT s.*, w.name AS warehouse_name FROM stock_items s JOIN warehouses w ON s.warehouse_id = w.id WHERE s.id = ?");
$stmt->execute([$id]);
$product = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$product) {
    header('Location: index.php?error=Product+not+found');
    exit;
}

// Enforce warehouse editing permissions
if (!RolePermissions::canEditWarehouse($currentUserRole, (int)$product['warehouse_id'])) {
    http_response_code(403);
    die("<div style='font-family:sans-serif;padding:40px;text-align:center;'><h2>403 Forbidden</h2><p>You do not have permission to edit products belonging to " . htmlspecialchars($product['warehouse_name']) . ".</p><a href='index.php'>Back to Products</a></div>");
}

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $itemName = trim($_POST['item_name'] ?? '');
    $itemType = trim($_POST['item_type'] ?? '');
    $category = trim($_POST['category'] ?? '');
    $variantColor = trim($_POST['variant_color'] ?? '');
    $size = trim($_POST['size'] ?? '');
    $unitPrice = (float)($_POST['unit_price'] ?? 0);
    $sellingPrice = (float)($_POST['selling_price'] ?? 0);
    $minQty = (int)($_POST['minimum_quantity'] ?? 5);

    $pcBrand = trim($_POST['pc_brand'] ?? '');
    $pcDeviceType = trim($_POST['pc_device_type'] ?? '');
    $pcModel = trim($_POST['pc_model'] ?? '');

    if (empty($itemName) || empty($category)) {
        $error = 'Product Name and Category are required.';
    } else {
        try {
            $stmt = $db->prepare("
                UPDATE stock_items SET
                    item_name = ?,
                    item_type = ?,
                    category = ?,
                    variant_color = ?,
                    size = ?,
                    unit_price = ?,
                    selling_price = ?,
                    minimum_quantity = ?,
                    pc_brand = ?,
                    pc_device_type = ?,
                    pc_model = ?,
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([
                $itemName,
                $itemType,
                $category,
                $variantColor,
                $size,
                $unitPrice,
                $sellingPrice,
                $minQty,
                $pcBrand,
                $pcDeviceType,
                $pcModel,
                $id
            ]);

            $success = 'Product updated successfully!';
            // Refresh product data
            $stmt = $db->prepare("SELECT s.*, w.name AS warehouse_name FROM stock_items s JOIN warehouses w ON s.warehouse_id = w.id WHERE s.id = ?");
            $stmt->execute([$id]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $error = 'Database error: ' . $e->getMessage();
        }
    }
}

$page_title = 'Edit Product: ' . $product['item_code'];
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
        <span class="badge bg-info text-dark">Editing: <?php echo htmlspecialchars($product['warehouse_name']); ?></span>
        <a href="index.php" class="btn btn-outline-light btn-sm"><i class="fas fa-arrow-left me-1"></i>Back to Products</a>
    </div>
</nav>

<div class="container py-4" style="max-width: 900px;">
    <div class="card shadow-sm border-0">
        <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 class="mb-0 font-weight-bold">
                <i class="fas fa-edit text-primary me-2"></i>Edit Product: <?php echo htmlspecialchars($product['item_code']); ?>
            </h5>
            <span class="badge <?php echo $product['warehouse_id'] == 1 ? 'bg-warning text-dark' : 'bg-danger'; ?>">
                <?php echo htmlspecialchars($product['warehouse_name']); ?>
            </span>
        </div>
        <div class="card-body p-4">
            <?php if ($error): ?>
                <div class="alert alert-danger"><i class="fas fa-circle-exclamation me-2"></i><?php echo htmlspecialchars($error); ?></div>
            <?php endif; ?>
            <?php if ($success): ?>
                <div class="alert alert-success"><i class="fas fa-circle-check me-2"></i><?php echo htmlspecialchars($success); ?></div>
            <?php endif; ?>

            <form method="POST">
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label font-weight-bold">Item Code (SKU)</label>
                        <input type="text" class="form-control bg-light" value="<?php echo htmlspecialchars($product['item_code']); ?>" readonly>
                        <small class="text-muted">Item codes are unique and cannot be modified.</small>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label font-weight-bold">Current Stock</label>
                        <input type="text" class="form-control bg-light font-weight-bold" value="<?php echo (int)$product['quantity']; ?> units" readonly>
                        <small class="text-muted">Use Stock In / Stock Out modules to record movements.</small>
                    </div>
                </div>

                <div class="row g-3 mb-3">
                    <div class="col-md-8">
                        <label class="form-label font-weight-bold">Product Name *</label>
                        <input type="text" name="item_name" class="form-control" required value="<?php echo htmlspecialchars($product['item_name']); ?>">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Category *</label>
                        <input type="text" name="category" class="form-control" required value="<?php echo htmlspecialchars($product['category']); ?>">
                    </div>
                </div>

                <div class="row g-3 mb-3">
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Item Type / Class</label>
                        <input type="text" name="item_type" class="form-control" value="<?php echo htmlspecialchars($product['item_type']); ?>">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Variant / Color</label>
                        <input type="text" name="variant_color" class="form-control" value="<?php echo htmlspecialchars($product['variant_color']); ?>">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Size / Dimension</label>
                        <input type="text" name="size" class="form-control" value="<?php echo htmlspecialchars($product['size']); ?>">
                    </div>
                </div>

                <?php if ($product['warehouse_id'] == 2): ?>
                <div class="p-3 mb-3 rounded bg-light border">
                    <h6 class="font-weight-bold text-secondary mb-3"><i class="fas fa-microchip me-2"></i>Computer Hardware Specifications (Astech)</h6>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label">Brand</label>
                            <input type="text" name="pc_brand" class="form-control" value="<?php echo htmlspecialchars($product['pc_brand']); ?>">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Device Type</label>
                            <input type="text" name="pc_device_type" class="form-control" value="<?php echo htmlspecialchars($product['pc_device_type']); ?>">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Model</label>
                            <input type="text" name="pc_model" class="form-control" value="<?php echo htmlspecialchars($product['pc_model']); ?>">
                        </div>
                    </div>
                </div>
                <?php endif; ?>

                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Unit Cost Price (RM)</label>
                        <input type="number" step="0.01" name="unit_price" class="form-control" value="<?php echo htmlspecialchars($product['unit_price']); ?>">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Selling Price (RM)</label>
                        <input type="number" step="0.01" name="selling_price" class="form-control" value="<?php echo htmlspecialchars($product['selling_price']); ?>">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Low Stock Alert Threshold</label>
                        <input type="number" name="minimum_quantity" class="form-control" value="<?php echo htmlspecialchars($product['minimum_quantity']); ?>">
                    </div>
                </div>

                <div class="d-flex justify-content-between">
                    <a href="index.php" class="btn btn-secondary px-4">Cancel</a>
                    <button type="submit" class="btn btn-primary px-4 font-weight-bold">Save Changes</button>
                </div>
            </form>
        </div>
    </div>
</div>

</body>
</html>
