<?php
// includes/SessionManager.php
class SessionManager {
    public static function start() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }
    
    public static function setUser($user) {
        $_SESSION['user'] = [
            'id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'] ?? $user['name'],
            'role' => $user['role'],
            'assigned_warehouse_id' => $user['assigned_warehouse_id'] ?? $user['warehouse_id'] ?? null
        ];
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_name'] = $user['full_name'];
        $_SESSION['user_role'] = $user['role'];
        $_SESSION['warehouse_id'] = $user['assigned_warehouse_id'];
        $_SESSION['logged_in'] = true;
        $_SESSION['login_time'] = time();
    }
    
    public static function getUser() {
        if (isset($_SESSION['user']) && !empty($_SESSION['user'])) {
            return [
                'id' => $_SESSION['user']['id'],
                'email' => $_SESSION['user']['email'],
                'name' => $_SESSION['user']['full_name'],
                'full_name' => $_SESSION['user']['full_name'],
                'role' => $_SESSION['user']['role'],
                'warehouse_id' => $_SESSION['user']['assigned_warehouse_id'] ?? $_SESSION['user']['warehouse_id'] ?? null
            ];
        }

        if (!self::isLoggedIn()) {
            return null;
        }
        return [
            'id' => $_SESSION['user_id'],
            'email' => $_SESSION['user_email'],
            'name' => $_SESSION['user_name'],
            'role' => $_SESSION['user_role'],
            'warehouse_id' => $_SESSION['warehouse_id']
        ];
    }
    
    public static function isLoggedIn() {
        return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
    }
    
    public static function isRole($role) {
        $user = self::getUser();
        return $user && $user['role'] === $role;
    }
    
    public static function hasPermission($permission) {
        $user = self::getUser();
        if (!$user) return false;
        return RolePermissions::hasPermission($user['role'], $permission);
    }
    
    public static function logout() {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    public static function destroy() {
        self::logout();
    }
}