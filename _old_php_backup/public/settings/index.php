<?php
/**
 * System Settings - Super Admin Only
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/roles.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireRole('super_admin');

$user = SessionManager::getUser();
$db = Database::getInstance()->getConnection();

$warehouses = $db->query("SELECT * FROM warehouses ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'System Configuration & Warehouses';
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
    <a class="navbar-brand font-weight-bold" href="../dashboard/super_admin.php">
        <i class="fas fa-boxes-stacked text-primary me-2"></i>HQ Inventory System
    </a>
    <div class="ms-auto d-flex align-items-center gap-3">
        <span class="badge bg-secondary"><?php echo htmlspecialchars($user['full_name']); ?> (Super Admin)</span>
        <a href="../dashboard/super_admin.php" class="btn btn-outline-light btn-sm"><i class="fas fa-home me-1"></i>Dashboard</a>
        <a href="../products/index.php" class="btn btn-outline-light btn-sm"><i class="fas fa-box me-1"></i>Products</a>
        <a href="../users/index.php" class="btn btn-outline-light btn-sm"><i class="fas fa-users me-1"></i>Users</a>
        <a href="../logout.php" class="btn btn-danger btn-sm"><i class="fas fa-sign-out-alt me-1"></i>Logout</a>
    </div>
</nav>

<div class="container py-4" style="max-width: 900px;">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h4 class="mb-1 font-weight-bold text-dark"><i class="fas fa-cog text-primary me-2"></i>Warehouse & System Configuration</h4>
            <p class="text-muted mb-0">Multi-warehouse isolation parameters and operational settings</p>
        </div>
    </div>

    <!-- Active Warehouses -->
    <div class="card shadow-sm border-0 mb-4">
        <div class="card-header bg-white py-3 font-weight-bold">
            <i class="fas fa-warehouse text-primary me-2"></i>Configured Warehouses
        </div>
        <div class="card-body p-0">
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Code</th>
                        <th>Warehouse Name</th>
                        <th>Sector / Specialty</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($warehouses as $wh): ?>
                        <tr>
                            <td class="font-weight-bold"><?php echo $wh['id']; ?></td>
                            <td><code><?php echo htmlspecialchars($wh['code']); ?></code></td>
                            <td class="font-weight-bold">
                                <?php echo htmlspecialchars($wh['name']); ?>
                            </td>
                            <td>
                                <?php if ($wh['id'] == 1): ?>
                                    <span class="badge bg-warning text-dark"><i class="fas fa-shirt me-1"></i>Clothing & Apparel (Kaftanasia)</span>
                                <?php else: ?>
                                    <span class="badge bg-danger"><i class="fas fa-laptop me-1"></i>Computers & Hardware (Astech)</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <span class="badge bg-success">Active & Operational</span>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Architecture Info -->
    <div class="card shadow-sm border-0">
        <div class="card-header bg-white py-3 font-weight-bold">
            <i class="fas fa-shield-halved text-success me-2"></i>Access Control & Multi-Tenancy Architecture
        </div>
        <div class="card-body p-4">
            <div class="row g-4">
                <div class="col-md-6">
                    <div class="p-3 border rounded bg-light">
                        <h6 class="font-weight-bold text-dark mb-2"><i class="fas fa-user-shield text-primary me-2"></i>Super Admin Role</h6>
                        <ul class="small text-muted mb-0 ps-3">
                            <li>Dual-warehouse oversight (Kaftanasia & Astech)</li>
                            <li>Full CRUD permissions across both warehouses</li>
                            <li>User management (Create, Toggle, Delete)</li>
                            <li>Complete system audit logging</li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="p-3 border rounded bg-light">
                        <h6 class="font-weight-bold text-dark mb-2"><i class="fas fa-store text-warning me-2"></i>Branch Admin Roles</h6>
                        <ul class="small text-muted mb-0 ps-3">
                            <li>Strict data isolation via <code>DataFilter</code> middleware</li>
                            <li>Kaftanasia Admin has zero visibility/access to Astech</li>
                            <li>Astech Admin has zero visibility/access to Kaftanasia</li>
                            <li>Manage stock in, stock out, returns, damage, and QR labels</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

</body>
</html>
