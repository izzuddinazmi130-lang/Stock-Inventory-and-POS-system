<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/sessionManager.php';

SessionManager::start();

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: $_POST;

$username = trim($data['username'] ?? '');
$password = trim($data['password'] ?? '');

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Sila masukkan username dan kata laluan.']);
    exit;
}

try {
    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare("
        SELECT u.*, w.name as warehouse_name 
        FROM users u
        LEFT JOIN warehouses w ON u.assigned_warehouse_id = w.id
        WHERE (u.email = ? OR u.username = ?)
        LIMIT 1
    ");
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Username atau kata laluan tidak sah.']);
        exit;
    }

    if ((int)($user['is_active'] ?? 0) === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Akaun anda masih menunggu kelulusan Super Admin.']);
        exit;
    }

    if ((int)($user['is_active'] ?? 0) === 2) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Pendaftaran akaun anda telah ditolak.']);
        exit;
    }

    // Map role for dashboard
    $storeRole = $user['role'];
    $redirect = 'dashboard.php';
    if ($user['role'] === 'admin_astech' || $user['username'] === 'daus') {
        $storeRole = 'stock_manager_astech';
        $redirect = 'stock_manager_astech_dashboard.html';
    } elseif ($user['role'] === 'admin_kaftanasia' || $user['username'] === 'test') {
        $storeRole = 'stock_manager_kaftan';
        $redirect = 'stock_manager_kaftan_dashboard.html';
    } elseif ($user['role'] === 'super_admin') {
        $storeRole = 'super_admin';
        $redirect = 'public/dashboard/super_admin.php';
    }

    $_SESSION['user'] = [
        'id' => (int)$user['id'],
        'email' => $user['email'],
        'username' => $user['username'] ?: $user['email'],
        'full_name' => $user['full_name'],
        'role' => $user['role'],
        'store_role' => $storeRole,
        'assigned_warehouse_id' => $user['assigned_warehouse_id'],
        'warehouse_id' => $user['assigned_warehouse_id'],
        'warehouse_name' => $user['warehouse_name']
    ];
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_name'] = $user['full_name'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['warehouse_id'] = $user['assigned_warehouse_id'];
    $_SESSION['logged_in'] = true;

    echo json_encode([
        'success' => true,
        'message' => 'Log masuk berjaya.',
        'user' => [
            'id' => (int)$user['id'],
            'username' => $user['username'] ?: $user['email'],
            'full_name' => $user['full_name'],
            'role' => $storeRole,
            'store_id' => $user['assigned_warehouse_id'] ?: 1,
            'store_name' => $user['warehouse_name'] ?: ($user['assigned_warehouse_id'] == 2 ? 'Astech Kedai PC' : 'Kaftan Asia Exclusive')
        ],
        'redirect' => $redirect
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ralat pelayan: ' . $e->getMessage()]);
}
