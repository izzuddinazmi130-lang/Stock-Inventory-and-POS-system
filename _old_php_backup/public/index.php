<?php
require_once __DIR__ . '/../includes/sessionManager.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/paths.php';

// Handle cases where URL starts with /public/ when server root is already public
$request_uri = $_SERVER['REQUEST_URI'] ?? '';
$parsed_path = parse_url($request_uri, PHP_URL_PATH) ?? '';
if (strpos($parsed_path, '/public/') === 0) {
    $corrected_path = substr($parsed_path, 7); // strip '/public'
    $query = parse_url($request_uri, PHP_URL_QUERY);
    $target = '/' . ltrim($corrected_path, '/') . ($query ? '?' . $query : '');
    header('Location: ' . $target);
    exit;
}

SessionManager::start();
if (SessionManager::isLoggedIn()) {
    $user = SessionManager::getUser();
    $role = $user['role'] ?? 'super_admin';
    header('Location: ' . app_url('dashboard/' . $role . '.php'));
    exit;
}
header('Location: ' . app_url('login.php'));
exit;
