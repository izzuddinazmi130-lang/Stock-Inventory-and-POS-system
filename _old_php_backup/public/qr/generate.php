<?php
/**
 * QR Code Generator for Products
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/DataFilter.php';
require_once __DIR__ . '/../../includes/QRCodeManager.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireLogin();

$user = SessionManager::getUser();
$currentUserRole = $user['role'];
$userWarehouseId = $user['assigned_warehouse_id'] ?? $user['warehouse_id'] ?? null;

$db = Database::getInstance()->getConnection();

$filterWarehouseId = null;
if ($currentUserRole !== 'super_admin') {
    $filterWarehouseId = $userWarehouseId;
} elseif (isset($_GET['warehouse']) && in_array((int)$_GET['warehouse'], [1, 2])) {
    $filterWarehouseId = (int)$_GET['warehouse'];
}

$productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
$qrResult = null;
$error = '';

if ($productId > 0) {
    // Permission check
    $stmt = $db->prepare("SELECT warehouse_id FROM stock_items WHERE id = ?");
    $stmt->execute([$productId]);
    $wh = $stmt->fetchColumn();

    if ($wh && RolePermissions::canViewWarehouse($currentUserRole, (int)$wh)) {
        $qrManager = new QRCodeManager();
        $qrResult = $qrManager->generateQRForItem($productId, $user['id'] ?? 1);
        if (isset($qrResult['error'])) {
            $error = $qrResult['error'];
        }
    } else {
        $error = "Access denied for this item.";
    }
}

// Fetch products list for selection
$query = "SELECT s.id, s.item_code, s.item_name, s.category, s.quantity, s.warehouse_id, w.name AS warehouse_name 
          FROM stock_items s 
          JOIN warehouses w ON s.warehouse_id = w.id 
          WHERE s.is_active = 1";
if ($filterWarehouseId) {
    $query .= " AND s.warehouse_id = " . (int)$filterWarehouseId;
}
$query .= " ORDER BY w.name, s.item_code ASC";
$items = $db->query($query)->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'QR Code Generator — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>QR Code Label Generator</h2>
                <p class="subtitle">Generate high-density QR asset labels for shelf inventory and rapid barcode scanner checkouts</p>
            </div>
            <div class="header-actions">
                <a href="scan.php" class="btn-modern btn-ghost">
                    <i class="fas fa-camera"></i> QR Scanner
                </a>
                <a href="../products/index.php" class="btn-modern btn-ghost">
                    <i class="fas fa-boxes-stacked"></i> View Inventory
                </a>
                <?php if ($qrResult && isset($qrResult['success'])): ?>
                    <button onclick="window.print()" class="btn-modern btn-primary-dark">
                        <i class="fas fa-print"></i> Print Label
                    </button>
                <?php endif; ?>
            </div>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-danger bg-danger text-white border-0 mb-4">
                <i class="fas fa-exclamation-circle me-2"></i><?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>

        <div class="row g-4">
            <!-- Left: Selector Panel -->
            <div class="col-lg-5">
                <div class="data-panel mb-0">
                    <div class="data-panel-header">
                        <h6><i class="fas fa-list me-2 text-primary"></i>Select Product (<?php echo count($items); ?>)</h6>
                    </div>
                    <div class="p-3 border-bottom border-dark" style="background: var(--bg-surface);">
                        <form method="GET" class="mb-0">
                            <label class="form-label-modern">Quick Search or Select</label>
                            <select name="product_id" class="form-select form-select-modern w-100" onchange="this.form.submit()">
                                <option value="">-- Choose an item --</option>
                                <?php foreach ($items as $item): ?>
                                    <option value="<?php echo $item['id']; ?>" <?php echo ($productId == $item['id']) ? 'selected' : ''; ?>>
                                        [<?php echo htmlspecialchars($item['warehouse_name']); ?>] <?php echo htmlspecialchars($item['item_code']); ?> - <?php echo htmlspecialchars($item['item_name']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </form>
                    </div>

                    <div style="max-height: 480px; overflow-y: auto;">
                        <?php foreach ($items as $item): ?>
                            <?php $isSelected = ($productId == $item['id']); ?>
                            <a href="generate.php?product_id=<?php echo $item['id']; ?>" 
                               class="d-flex justify-content-between align-items-center p-3 text-decoration-none border-bottom border-dark"
                               style="background: <?php echo $isSelected ? 'rgba(79, 70, 229, 0.18)' : 'transparent'; ?>; transition: background 150ms ease;">
                                <div>
                                    <div class="d-flex align-items-center gap-2 mb-1">
                                        <span class="cell-strong font-monospace text-primary small"><?php echo htmlspecialchars($item['item_code']); ?></span>
                                        <span class="badge-modern <?php echo $item['warehouse_id'] == 1 ? 'badge-gold' : 'badge-red'; ?>">
                                            <?php echo htmlspecialchars($item['warehouse_name']); ?>
                                        </span>
                                    </div>
                                    <div class="cell-muted" style="font-size: 13px; color: var(--text-primary);"><?php echo htmlspecialchars($item['item_name']); ?></div>
                                </div>
                                <span class="badge-modern badge-neutral">
                                    <?php echo (int)$item['quantity']; ?> in stock
                                </span>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <!-- Right: QR Label Output -->
            <div class="col-lg-7">
                <div class="data-panel mb-0 h-100">
                    <div class="data-panel-header">
                        <h6><i class="fas fa-qrcode me-2 text-primary"></i>Generated Label Output</h6>
                        <?php if ($qrResult && isset($qrResult['success'])): ?>
                            <span class="badge-modern badge-green"><i class="fas fa-check me-1"></i>Ready to Print</span>
                        <?php endif; ?>
                    </div>
                    <div class="p-4 d-flex flex-column align-items-center justify-content-center" style="min-height: 450px;">
                        <?php if ($qrResult && isset($qrResult['success'])): ?>
                            <?php $item = $qrResult['item']; ?>
                            <!-- Printable Physical Label Card (Styled for crisp scanning & visual appeal) -->
                            <div class="p-4 bg-white text-dark rounded-3 shadow text-center" style="width: 100%; max-width: 360px; border: 2px dashed #cbd5e1;">
                                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                    <span class="badge <?php echo $item['warehouse_id'] == 1 ? 'bg-warning text-dark' : 'bg-danger text-white'; ?> fw-bold px-2 py-1" style="font-size: 11px;">
                                        <?php echo htmlspecialchars($item['warehouse_name']); ?> HQ
                                    </span>
                                    <span class="text-muted small fw-semibold font-monospace">
                                        SKU: <?php echo htmlspecialchars($item['item_code']); ?>
                                    </span>
                                </div>

                                <h6 class="fw-bold mb-1 text-dark" style="font-size: 15px;"><?php echo htmlspecialchars($item['item_name']); ?></h6>
                                <div class="text-muted small mb-3"><?php echo htmlspecialchars($item['category']); ?></div>

                                <!-- QR SVG Container -->
                                <div class="p-2 bg-white d-inline-block rounded border mb-3" style="max-width: 220px;">
                                    <?php echo $qrResult['qr_svg']; ?>
                                </div>

                                <div class="bg-light p-2 rounded mb-2 font-monospace small text-secondary">
                                    <?php echo htmlspecialchars($qrResult['qr_code']); ?>
                                </div>

                                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                    <span class="text-muted small">Selling Price</span>
                                    <span class="fw-bold text-dark fs-6">RM <?php echo number_format($item['selling_price'], 2); ?></span>
                                </div>
                            </div>

                            <div class="mt-4 d-flex gap-2">
                                <button onclick="window.print()" class="btn-modern btn-primary-dark">
                                    <i class="fas fa-print"></i> Print Label Now
                                </button>
                                <a href="generate.php" class="btn-modern btn-ghost">
                                    <i class="fas fa-redo"></i> Select Another
                                </a>
                            </div>
                        <?php else: ?>
                            <div class="empty-state">
                                <i class="fas fa-qrcode fa-4x d-block text-secondary opacity-25"></i>
                                <h6 class="text-primary mt-3 fw-bold">No Product Selected</h6>
                                <p class="text-muted mb-0">Select an item from the list on the left to immediately generate its official inventory label.</p>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
