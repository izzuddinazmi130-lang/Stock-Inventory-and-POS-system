<?php
/**
 * Role-Based Access Control Middleware & Permission Matrix
 */

require_once __DIR__ . '/paths.php';

class RolePermissions {
    
    // Permission Matrix - What each role can do
    private static $permissions = [
        'super_admin' => [
            'view_kaftanasia' => true,
            'view_astech' => true,
            'edit_kaftanasia' => true,
            'edit_astech' => true,
            'manage_users' => true,
            'view_all' => true,
            'system_settings' => true,
            'generate_qr' => true,
            'manage_returns' => true,
            'manage_damage' => true,
            'view_reports' => true,
            'audit_logs' => true
        ],
        'admin_kaftanasia' => [
            'view_kaftanasia' => true,
            'view_astech' => false,        // CANNOT view Astech
            'edit_kaftanasia' => true,
            'edit_astech' => false,        // CANNOT edit Astech
            'manage_users' => false,
            'view_all' => false,
            'system_settings' => false,
            'generate_qr' => true,
            'manage_returns' => true,
            'manage_damage' => true,
            'view_reports' => true,
            'audit_logs' => false
        ],
        'admin_astech' => [
            'view_kaftanasia' => false,     // CANNOT view Kaftanasia
            'view_astech' => true,
            'edit_kaftanasia' => false,     // CANNOT edit Kaftanasia
            'edit_astech' => true,
            'manage_users' => false,
            'view_all' => false,
            'system_settings' => false,
            'generate_qr' => true,
            'manage_returns' => true,
            'manage_damage' => true,
            'view_reports' => true,
            'audit_logs' => false
        ]
    ];
    
    public static function hasPermission($user_role, $permission) {
        return self::$permissions[$user_role][$permission] ?? false;
    }
    
    public static function can($user_role, $permission) {
        return self::hasPermission($user_role, $permission);
    }
    
    public static function checkAccess($permission) {
        $user_role = $_SESSION['user_role'] ?? null;
        
        if (!$user_role) {
            header('Location: ' . app_url('login.php'));
            exit;
        }
        
        if (!self::hasPermission($user_role, $permission)) {
            http_response_code(403);
            die('<div style="font-family:sans-serif;padding:30px;text-align:center;"><h2>403 Access Denied</h2><p>Your role (' . htmlspecialchars($user_role) . ') does not have permission for this action.</p><p><a href="javascript:history.back()">Go Back</a></p></div>');
        }
        return true;
    }

    public static function getPermissions($user_role) {
        return self::$permissions[$user_role] ?? [];
    }

    public static function getWarehouseAccess($user_role) {
        if ($user_role === 'super_admin') return [1, 2];
        if ($user_role === 'admin_kaftanasia') return [1];
        if ($user_role === 'admin_astech') return [2];
        return [];
    }

    public static function canViewWarehouse($user_role, $warehouse_id) {
        if ($user_role === 'super_admin') return true;
        if ($user_role === 'admin_kaftanasia' && (int)$warehouse_id === 1) return true;
        if ($user_role === 'admin_astech' && (int)$warehouse_id === 2) return true;
        return false;
    }

    public static function canEditWarehouse($user_role, $warehouse_id) {
        if ($user_role === 'super_admin') return true;
        if ($user_role === 'admin_kaftanasia' && (int)$warehouse_id === 1) return true;
        if ($user_role === 'admin_astech' && (int)$warehouse_id === 2) return true;
        return false;
    }

    public static function getRoleLabel($user_role) {
        $labels = [
            'super_admin' => 'Super Admin',
            'admin_kaftanasia' => 'Kaftanasia Admin',
            'admin_astech' => 'Astech Admin'
        ];
        return $labels[$user_role] ?? $user_role;
    }
    
    public static function getMenuItems($user_role) {
        $menus = [
            'super_admin' => [
                ['label' => 'Dashboard', 'icon' => 'tachometer-alt', 'url' => app_url('dashboard/super_admin.php')],
                ['label' => 'All Products', 'icon' => 'box', 'url' => app_url('products/index.php')],
                ['label' => 'QR Codes', 'icon' => 'qrcode', 'url' => app_url('qr/manage.php')],
                ['label' => 'Returns & Damage', 'icon' => 'undo', 'url' => app_url('returns/index.php')],
                ['label' => 'Users', 'icon' => 'users', 'url' => app_url('users/index.php')],
                ['label' => 'Reports', 'icon' => 'chart-bar', 'url' => app_url('reports/index.php')],
                ['label' => 'Audit Logs', 'icon' => 'history', 'url' => app_url('audit/index.php')]
            ],
            'admin_kaftanasia' => [
                ['label' => 'Dashboard', 'icon' => 'tachometer-alt', 'url' => app_url('dashboard/admin_kaftanasia.php')],
                ['label' => 'Kaftan Products', 'icon' => 'tshirt', 'url' => app_url('products/index.php?warehouse=1')],
                ['label' => 'QR Codes', 'icon' => 'qrcode', 'url' => app_url('qr/manage.php?warehouse=1')],
                ['label' => 'Returns & Damage', 'icon' => 'undo', 'url' => app_url('returns/index.php?warehouse=1')],
                ['label' => 'Reports', 'icon' => 'chart-bar', 'url' => app_url('reports/index.php?warehouse=1')]
            ],
            'admin_astech' => [
                ['label' => 'Dashboard', 'icon' => 'tachometer-alt', 'url' => app_url('dashboard/admin_astech.php')],
                ['label' => 'Astech Products', 'icon' => 'laptop', 'url' => app_url('products/index.php?warehouse=2')],
                ['label' => 'QR Codes', 'icon' => 'qrcode', 'url' => app_url('qr/manage.php?warehouse=2')],
                ['label' => 'Returns & Damage', 'icon' => 'undo', 'url' => app_url('returns/index.php?warehouse=2')],
                ['label' => 'Reports', 'icon' => 'chart-bar', 'url' => app_url('reports/index.php?warehouse=2')]
            ]
        ];
        
        return $menus[$user_role] ?? [];
    }
}
