<?php
// public/logout.php
require_once __DIR__ . '/../includes/sessionManager.php';
require_once __DIR__ . '/../includes/paths.php';

SessionManager::start();
SessionManager::destroy();

header('Location: ' . app_url('login.php'));
exit;
