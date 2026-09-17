<?php
// public/products/add.php - Add Product with Role Permissions
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/DataFilter.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: ' . app_url('login.php'));
    exit;
}

$user = SessionManager::getUser();
$db = Database::getInstance()->getConnection();
$error = '';
$success = '';

// Determine target warehouse based on role
$forcedWarehouse = DataFilter::getWarehouseFilter();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $warehouse_id = $forcedWarehouse !== null ? $forcedWarehouse : (int)($_POST['warehouse_id'] ?? 1);
    
    // Check permission - STEP 11 & 12 in Spec
    $permission = $warehouse_id == 1 ? 'edit_kaftanasia' : 'edit_astech';
    RolePermissions::checkAccess($permission);
    
    $item_code = trim($_POST['item_code'] ?? '');
    $item_name = trim($_POST['item_name'] ?? '');
    $item_type = trim($_POST['item_type'] ?? '');
    $category = trim($_POST['category'] ?? '');
    $variant_color = trim($_POST['variant_color'] ?? '');
    $size = trim($_POST['size'] ?? '');
    $unit_price = (float)($_POST['unit_price'] ?? 0);
    $selling_price = (float)($_POST['selling_price'] ?? 0);
    $quantity = (int)($_POST['quantity'] ?? 0);
    $minimum_quantity = (int)($_POST['minimum_quantity'] ?? 0);
    
    if (empty($item_code) || empty($item_name)) {
        $error = "Item code and item name are required.";
    } else {
        $stmt = $db->prepare("
            INSERT INTO stock_items (
                warehouse_id, item_code, item_name, item_type, category,
                variant_color, size, unit_price, selling_price, quantity,
                minimum_quantity, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ");
        $stmt->execute([
            $warehouse_id, $item_code, $item_name, $item_type, $category,
            $variant_color, $size, $unit_price, $selling_price, $quantity,
            $minimum_quantity
        ]);
        $newId = $db->lastInsertId();
        
        if ($quantity > 0) {
            $db->prepare("
                INSERT INTO stock_movements (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note)
                VALUES (?, ?, 'in', ?, 0, ?, ?, ?, 'Initial inventory add')
            ")->execute([$warehouse_id, $newId, $quantity, $quantity, $unit_price, $selling_price]);
        }
        
        $success = "Product successfully created!";
    }
}

$page_title = "Add Product";
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1 p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="h4 mb-0 font-weight-bold">Add New Product</h2>
            <a href="index.php" class="btn btn-outline-secondary btn-sm">&larr; Back to Products</a>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-danger"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        <?php if ($success): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>

        <div class="card border-0 shadow-sm rounded-3 p-4 bg-white" style="max-width: 700px;">
            <form method="POST" action="">
                <?php if ($forcedWarehouse === null): ?>
                    <div class="mb-3">
                        <label class="form-label font-weight-bold">Warehouse Target</label>
                        <select name="warehouse_id" class="form-select" required>
                            <option value="1">Kaftanasia Warehouse (Clothing)</option>
                            <option value="2">Astech Warehouse (Computer)</option>
                        </select>
                    </div>
                <?php else: ?>
                    <input type="hidden" name="warehouse_id" value="<?php echo $forcedWarehouse; ?>">
                    <div class="mb-3">
                        <span class="badge <?php echo $forcedWarehouse == 1 ? 'bg-warning text-dark' : 'bg-danger'; ?> py-2 px-3">
                            Target Warehouse: <?php echo $forcedWarehouse == 1 ? 'Kaftanasia' : 'Astech'; ?>
                        </span>
                    </div>
                <?php endif; ?>

                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label font-weight-bold">Item Code (SKU)</label>
                        <input type="text" name="item_code" class="form-control" required placeholder="e.g. KA-101 or AS-201">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label font-weight-bold">Item Name</label>
                        <input type="text" name="item_name" class="form-control" required placeholder="Product full name">
                    </div>
                </div>

                <div class="row g-3 mb-3">
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Type</label>
                        <input type="text" name="item_type" class="form-control" placeholder="e.g. ABAYA or PC or Component">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Category</label>
                        <input type="text" name="category" class="form-control" placeholder="e.g. ZEHRA or CPU">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label font-weight-bold">Variant / Size</label>
                        <input type="text" name="variant_color" class="form-control" placeholder="Color or model">
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <label class="form-label font-weight-bold">Unit Cost (RM)</label>
                        <input type="number" step="0.01" name="unit_price" class="form-control" value="0.00">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label font-weight-bold">Selling Price (RM)</label>
                        <input type="number" step="0.01" name="selling_price" class="form-control" value="0.00">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label font-weight-bold">Initial Qty</label>
                        <input type="number" name="quantity" class="form-control" value="10">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label font-weight-bold">Min Threshold</label>
                        <input type="number" name="minimum_quantity" class="form-control" value="2">
                    </div>
                </div>

                <button type="submit" class="btn btn-primary px-4 font-weight-bold">Save Product</button>
            </form>
        </div>
    </main>
</div>

</body>
</html>
