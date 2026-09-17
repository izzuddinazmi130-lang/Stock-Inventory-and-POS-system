<?php
require_once __DIR__ . '/includes/sessionManager.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/paths.php';

SessionManager::start();
if (SessionManager::isLoggedIn()) {
    $user = SessionManager::getUser();
    $role = $user['role'] ?? 'super_admin';
    header('Location: ' . app_url('dashboard/' . $role . '.php'));
    exit;
}
header('Location: ' . app_url('login.php'));
exit;
