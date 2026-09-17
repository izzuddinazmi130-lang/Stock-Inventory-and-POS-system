<?php
/**
 * System Header — Global Topbar and Assets
 * HQ Multi-Role Inventory Management System
 */

$user = $_SESSION['user'] ?? null;
$role = $user['role'] ?? null;
$menu_items = RolePermissions::getMenuItems($role);

$role_labels = [
    'super_admin'      => 'Super Admin',
    'admin_kaftanasia' => 'Kaftanasia Admin',
    'admin_astech'     => 'Astech Admin'
];
$displayRole = $role_labels[$role] ?? ($role ? ucfirst(str_replace('_', ' ', $role)) : 'Staff');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($page_title ?? 'HQ Inventory System'); ?></title>
    
    <!-- Fonts & Icons -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Global Style -->
    <link rel="stylesheet" href="<?php echo htmlspecialchars(app_url('assets/css/style.css')); ?>">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

    <style>
        /* Fallback safety styles for header and sidebar layout */
        body {
            margin: 0;
            background-color: #0a0a0a;
            color: #f8fafc;
            font-family: 'Inter', system-ui, sans-serif;
        }
        .header {
            height: 64px;
            background-color: #0f172a;
            border-bottom: 1px solid #1e293b;
            display: flex;
            align-items: center;
            padding: 0 24px;
            position: sticky;
            top: 0;
            z-index: 1000;
        }
        .header-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .brand-link {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: #ffffff;
        }
        .brand-icon-box {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 15px;
            color: #ffffff;
        }
        .brand-text-label {
            font-size: 16px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #ffffff;
        }
        .header-right {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .header-user-pill {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px 14px 4px 6px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .user-avatar-circle {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: #4f46e5;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
        }
        .user-info-text {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
        }
        .user-full-name {
            font-size: 13px;
            font-weight: 600;
            color: #f8fafc;
        }
        .user-role-badge {
            font-size: 10.5px;
            color: #94a3b8;
            font-weight: 500;
        }
        .btn-top-logout {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 14px;
            background-color: rgba(239, 68, 68, 0.12);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.28);
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
            text-decoration: none;
            transition: all 150ms ease;
        }
        .btn-top-logout:hover {
            background-color: #ef4444;
            color: #ffffff;
        }
        .sidebar {
            width: 240px;
            min-width: 240px;
            background-color: #111827;
            border-right: 1px solid #1f2937;
            padding: 20px 12px;
            flex-shrink: 0;
        }
        .sidebar-heading-text {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            padding: 0 12px 10px;
        }
        .nav-list-menu {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .nav-item-entry {
            margin: 0;
        }
        .nav-item-entry a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            border-radius: 10px;
            color: #9ca3af;
            text-decoration: none;
            font-size: 13.5px;
            font-weight: 500;
            transition: all 150ms ease;
            border-left: 3px solid transparent;
        }
        .nav-item-entry a:hover {
            color: #ffffff;
            background-color: rgba(255, 255, 255, 0.06);
            transform: translateX(2px);
        }
        .nav-item-entry.active a,
        .nav-item-entry a.active {
            color: #ffffff;
            background: linear-gradient(90deg, rgba(79, 70, 229, 0.22) 0%, rgba(79, 70, 229, 0.05) 100%);
            border-left-color: #818cf8;
            font-weight: 600;
        }
        .nav-item-entry a i {
            font-size: 15px;
            width: 18px;
            text-align: center;
            color: #818cf8;
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-container">
            <div class="logo">
                <a href="<?php echo htmlspecialchars(app_url('dashboard/' . $role . '.php')); ?>" class="brand-link">
                    <span class="brand-icon-box">HQ</span>
                    <span class="brand-text-label">Inventory Management</span>
                </a>
            </div>
            
            <div class="header-right">
                <div class="header-user-pill">
                    <span class="user-avatar-circle"><?php echo strtoupper(substr($user['full_name'] ?? 'U', 0, 1)); ?></span>
                    <div class="user-info-text">
                        <span class="user-full-name"><?php echo htmlspecialchars($user['full_name'] ?? 'User'); ?></span>
                        <span class="user-role-badge"><?php echo htmlspecialchars($displayRole); ?></span>
                    </div>
                </div>
                <a href="<?php echo htmlspecialchars(app_url('logout.php')); ?>" class="btn-top-logout" title="Sign Out">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Log Out</span>
                </a>
            </div>
        </div>
    </header>