<?php
/**
 * Authentication & Access Control System
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/paths.php';

class Auth {
    private $pdo;
    private $session_timeout = 3600; // 1 hour

    public function __construct($pdo = null) {
        $this->pdo = $pdo;
        self::initSession();
    }

    /**
     * Ensure session is started safely
     */
    public static function initSession() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    /**
     * User Login Method
     * Validates credentials and distinguishes inactive/pending accounts
     *
     * @param string $email Email or Username
     * @param string $password Plaintext password
     * @return array [success => bool, message => string, code => string, user => array, redirect => string]
     */
    public function login($email, $password) {
        $email = trim($email);
        $password = trim($password);

        if (empty($email) || empty($password)) {
            return [
                'success' => false,
                'code' => 'missing_fields',
                'message' => 'Email and password are required.'
            ];
        }

        if (!$this->pdo instanceof PDO) {
            require_once __DIR__ . '/../config/database.php';
            $this->pdo = Database::getInstance()->getConnection();
        }

        // Fetch user record by email or username (WITHOUT filtering is_active)
        $stmt = $this->pdo->prepare("
            SELECT u.*, w.name AS warehouse_name 
            FROM users u
            LEFT JOIN warehouses w ON u.assigned_warehouse_id = w.id
            WHERE (u.email = ? OR u.username = ?)
            LIMIT 1
        ");
        $stmt->execute([$email, $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // User does not exist OR password does not match (NO BACKDOORS)
        if (!$user || !password_verify($password, $user['password_hash'])) {
            return [
                'success' => false,
                'code' => 'invalid_credentials',
                'message' => 'Invalid email/username or password.'
            ];
        }

        // Check account approval status
        $isActive = (int)($user['is_active'] ?? 0);

        if ($isActive === 0) {
            return [
                'success' => false,
                'code' => 'pending_approval',
                'message' => 'Your account is pending Super Admin approval. Please wait for activation.'
            ];
        }

        if ($isActive === 2) {
            return [
                'success' => false,
                'code' => 'account_rejected',
                'message' => 'Your account registration was declined. Please contact HQ administration.'
            ];
        }

        // Update last login timestamp
        try {
            $stmt = $this->pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $stmt->execute([$user['id']]);
        } catch (Throwable $e) {
            error_log("Failed to update last_login: " . $e->getMessage());
        }

        // Establish session
        self::initSession();
        $_SESSION['user'] = [
            'id' => (int)$user['id'],
            'email' => $user['email'],
            'username' => $user['username'] ?? $user['email'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
            'assigned_warehouse_id' => $user['assigned_warehouse_id'],
            'warehouse_name' => $user['warehouse_name']
        ];
        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_name'] = $user['full_name'];
        $_SESSION['user_role'] = $user['role'];
        $_SESSION['warehouse_id'] = $user['assigned_warehouse_id'];
        $_SESSION['logged_in'] = true;
        $_SESSION['last_activity'] = time();

        // Audit log
        $this->logActivity($user['id'], 'login', 'User logged in successfully');

        return [
            'success' => true,
            'code' => 'ok',
            'user' => $_SESSION['user'],
            'redirect' => self::getDashboardUrl($user['role'])
        ];
    }

    /**
     * User Logout Method
     */
    public function logout() {
        self::initSession();
        if ($this->isLoggedIn() && $this->pdo instanceof PDO) {
            $user = $this->getCurrentUser();
            if ($user && isset($user['id'])) {
                $this->logActivity($user['id'], 'logout', 'User logged out');
            }
        }

        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        return true;
    }

    /**
     * Check if user is logged in
     */
    public static function isLoggedIn() {
        self::initSession();
        return (isset($_SESSION['user']) && !empty($_SESSION['user']))
            || (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true);
    }

    /**
     * Check if session has expired
     */
    public function isSessionExpired() {
        self::initSession();
        if (!isset($_SESSION['last_activity'])) {
            return true;
        }
        return (time() - $_SESSION['last_activity']) > $this->session_timeout;
    }

    /**
     * Get current user array
     */
    public static function getCurrentUser() {
        self::initSession();
        if (isset($_SESSION['user']) && !empty($_SESSION['user'])) {
            return $_SESSION['user'];
        }

        if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
            return [
                'id' => $_SESSION['user_id'] ?? null,
                'email' => $_SESSION['user_email'] ?? '',
                'full_name' => $_SESSION['user_name'] ?? '',
                'role' => $_SESSION['user_role'] ?? '',
                'assigned_warehouse_id' => $_SESSION['warehouse_id'] ?? null
            ];
        }

        return null;
    }

    /**
     * Check if current user has a specific role
     */
    public static function hasRole($role) {
        $user = self::getCurrentUser();
        return $user && isset($user['role']) && $user['role'] === $role;
    }

    /**
     * Check if current user has any of the specified roles
     */
    public static function hasAnyRole($roles) {
        $user = self::getCurrentUser();
        return $user && isset($user['role']) && in_array($user['role'], (array)$roles, true);
    }

    /**
     * Single Source of Truth for Role-Based Dashboard Redirection
     *
     * @param string $role
     * @return string Absolute or relative URL to dashboard
     */
    public static function getDashboardUrl($role) {
        $urls = [
            'super_admin'       => app_url('dashboard/super_admin.php'),
            'admin_kaftanasia'  => app_url('dashboard/admin_kaftanasia.php'),
            'admin_astech'      => app_url('dashboard/admin_astech.php')
        ];
        return $urls[$role] ?? app_url('login.php');
    }

    /**
     * Require authentication middleware (callable statically or as instance)
     */
    public static function requireLogin() {
        self::initSession();
        if (!self::isLoggedIn()) {
            header('Location: ' . app_url('login.php'));
            exit;
        }
        $_SESSION['last_activity'] = time();
    }

    public function requireAuth() {
        self::requireLogin();
    }

    /**
     * Require specific role middleware
     */
    public static function requireRole($role) {
        self::requireLogin();
        $user = self::getCurrentUser();
        $current_role = $user['role'] ?? null;

        if ($current_role !== $role) {
            http_response_code(403);
            if (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
                die(json_encode(['error' => 'Access denied. Required role: ' . $role]));
            }
            die('Access Denied: You do not have permission to view this page. Required role: ' . htmlspecialchars($role));
        }
    }

    /**
     * Require any of the specified roles middleware
     */
    public static function requireAnyRole($roles) {
        self::requireLogin();
        $user = self::getCurrentUser();
        $current_role = $user['role'] ?? null;

        if (!in_array($current_role, (array)$roles, true)) {
            http_response_code(403);
            if (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
                die(json_encode(['error' => 'Access denied. Required roles: ' . implode(', ', (array)$roles)]));
            }
            die('Access Denied: You do not have permission to view this page.');
        }
    }

    /**
     * Log user activity to audit_logs
     */
    private function logActivity($user_id, $action, $description) {
        if (!$this->pdo instanceof PDO) return;
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO audit_logs (user_id, action, ip_address, user_agent, new_values) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $user_id,
                $action,
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                $_SERVER['HTTP_USER_AGENT'] ?? 'System',
                json_encode(['description' => $description])
            ]);
        } catch (Throwable $e) {
            error_log("Activity log error: " . $e->getMessage());
        }
    }
}