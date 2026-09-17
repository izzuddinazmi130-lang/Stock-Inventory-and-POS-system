<?php
/**
 * Add New User - Super Admin Only
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/roles.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireRole('super_admin');

$db = Database::getInstance()->getConnection();
$user = SessionManager::getUser();

// Get warehouses for dropdown
$stmt = $db->query("SELECT id, name FROM warehouses WHERE is_active = 1");
$warehouses = $stmt->fetchAll(PDO::FETCH_ASSOC);

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';
    $full_name = trim($_POST['full_name'] ?? '');
    $role = $_POST['role'] ?? '';
    $assigned_warehouse = !empty($_POST['assigned_warehouse']) ? (int)$_POST['assigned_warehouse'] : null;

    if (empty($email) || empty($password) || empty($full_name) || empty($role)) {
        $error = 'All fields are required.';
    } elseif (strlen($password) < 6) {
        $error = 'Password must be at least 6 characters.';
    } else {
        try {
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                throw new Exception('An account with this email already exists.');
            }

            $parts = explode('@', $email);
            $username = preg_replace('/[^a-zA-Z0-9_]/', '', $parts[0]);
            $password_hash = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $db->prepare("
                INSERT INTO users (email, username, password_hash, full_name, role, assigned_warehouse_id, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
            ");
            $stmt->execute([
                $email,
                $username,
                $password_hash,
                $full_name,
                $role,
                $assigned_warehouse
            ]);

            $success = 'User account created successfully!';
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    }
}

$page_title = 'Create New User — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>Create New User Account</h2>
                <p class="subtitle">Provision internal credentials, assign access roles, and link warehouse management scope</p>
            </div>
            <div class="header-actions">
                <a href="<?php echo htmlspecialchars(app_url('users/index.php')); ?>" class="btn-modern btn-ghost">
                    <i class="fas fa-arrow-left"></i> User Directory
                </a>
                <a href="<?php echo htmlspecialchars(app_url('users/pending.php')); ?>" class="btn-modern btn-ghost-warning">
                    <i class="fas fa-user-clock"></i> Pending Approvals
                </a>
            </div>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-danger bg-danger text-white border-0 mb-4 d-flex align-items-center">
                <i class="fas fa-circle-exclamation me-2"></i><?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>

        <?php if ($success): ?>
            <div class="alert alert-success bg-success text-white border-0 mb-4 d-flex align-items-center justify-content-between">
                <div><i class="fas fa-circle-check me-2"></i><?php echo htmlspecialchars($success); ?></div>
                <a href="<?php echo htmlspecialchars(app_url('users/index.php')); ?>" class="btn btn-sm btn-light font-weight-bold">
                    <i class="fas fa-users me-1"></i> Return to Directory
                </a>
            </div>
        <?php endif; ?>

        <div class="row justify-content-center">
            <div class="col-xl-8 col-lg-10">
                <div class="data-panel">
                    <div class="data-panel-header">
                        <h6><i class="fas fa-user-plus me-2 text-primary"></i>Account Information & Role Assignment</h6>
                        <span class="text-muted small">* Required fields</span>
                    </div>
                    <div class="p-4">
                        <form method="POST">
                            <div class="row g-3 mb-3">
                                <div class="col-md-6">
                                    <label class="form-label-modern">Full Name *</label>
                                    <input type="text" name="full_name" class="form-control form-control-modern" required placeholder="e.g. Sarah Jenkins" value="<?php echo htmlspecialchars($_POST['full_name'] ?? ''); ?>">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label-modern">Email Address *</label>
                                    <input type="email" name="email" class="form-control form-control-modern" required placeholder="e.g. sarah@hq.com" value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>">
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label-modern">Password *</label>
                                <input type="password" name="password" class="form-control form-control-modern" required minlength="6" placeholder="Minimum 6 characters">
                                <div class="cell-muted small mt-1">Must be at least 6 characters. A temporary password can be reset upon first login.</div>
                            </div>

                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <label class="form-label-modern">System Role *</label>
                                    <select name="role" id="roleSelect" class="form-select form-select-modern" required onchange="handleRoleChange(this.value)">
                                        <option value="">-- Select Assigned Role --</option>
                                        <option value="super_admin" <?php echo (($_POST['role'] ?? '') === 'super_admin') ? 'selected' : ''; ?>>Super Admin (HQ Full Access)</option>
                                        <option value="admin_kaftanasia" <?php echo (($_POST['role'] ?? '') === 'admin_kaftanasia') ? 'selected' : ''; ?>>Admin Kaftanasia (Clothing Warehouse)</option>
                                        <option value="admin_astech" <?php echo (($_POST['role'] ?? '') === 'admin_astech') ? 'selected' : ''; ?>>Admin Astech (Computer Hardware Warehouse)</option>
                                    </select>
                                </div>

                                <div class="col-md-6" id="warehouseGroup">
                                    <label class="form-label-modern">Assigned Warehouse</label>
                                    <select name="assigned_warehouse" id="whSelect" class="form-select form-select-modern">
                                        <option value="">None (HQ / Cross-Warehouse)</option>
                                        <?php foreach ($warehouses as $w): ?>
                                            <option value="<?php echo $w['id']; ?>" <?php echo ((string)($_POST['assigned_warehouse'] ?? '') === (string)$w['id']) ? 'selected' : ''; ?>>
                                                <?php echo htmlspecialchars($w['name']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <div class="cell-muted small mt-1">Automatically mapped based on branch admin selection.</div>
                                </div>
                            </div>

                            <div class="d-flex justify-content-between align-items-center pt-3 border-top border-dark">
                                <a href="<?php echo htmlspecialchars(app_url('users/index.php')); ?>" class="btn-modern btn-ghost">
                                    Cancel
                                </a>
                                <button type="submit" class="btn-modern btn-primary-dark">
                                    <i class="fas fa-check me-1"></i> Create User Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
function handleRoleChange(role) {
    const whSelect = document.getElementById('whSelect');
    if (role === 'admin_kaftanasia') {
        whSelect.value = '1';
    } else if (role === 'admin_astech') {
        whSelect.value = '2';
    } else if (role === 'super_admin') {
        whSelect.value = '';
    }
}
</script>
</body>
</html>
