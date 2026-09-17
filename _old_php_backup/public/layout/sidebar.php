<?php
/**
 * System Sidebar Navigation Menu
 * HQ Multi-Role Inventory Management System
 */

$current_script = $_SERVER['SCRIPT_NAME'] ?? ($_SERVER['PHP_SELF'] ?? '');
$current_file = basename($current_script);
$current_dir = basename(dirname($current_script));
?>
<aside class="sidebar">
    <nav class="sidebar-nav">
        <div class="sidebar-heading sidebar-heading-text">Control Center</div>
        <ul class="nav-list nav-list-menu">
            <?php foreach ($menu_items as $item): ?>
                <?php 
                    $item_path = parse_url($item['url'], PHP_URL_PATH);
                    $item_file = basename($item_path);
                    $item_dir = basename(dirname($item_path));
                    
                    $isActive = false;
                    if ($current_dir === 'dashboard' && $item_dir === 'dashboard') {
                        $isActive = ($current_file === $item_file);
                    } elseif ($current_dir !== 'dashboard' && $current_dir !== 'public' && $current_dir !== 'hq-inventory-system' && $current_dir !== '') {
                        $isActive = ($current_dir === $item_dir);
                    } else {
                        $isActive = ($current_file === $item_file);
                    }
                ?>
                <li class="nav-item nav-item-entry <?php echo $isActive ? 'active' : ''; ?>">
                    <a href="<?php echo htmlspecialchars($item['url']); ?>" class="nav-link <?php echo $isActive ? 'active' : ''; ?>">
                        <i class="fas fa-<?php echo htmlspecialchars($item['icon']); ?> nav-icon"></i>
                        <span class="nav-text"><?php echo htmlspecialchars($item['label']); ?></span>
                    </a>
                </li>
            <?php endforeach; ?>
        </ul>
    </nav>
</aside>