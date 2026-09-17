<?php
/**
 * Helper Functions
 */

/**
 * Sanitize input
 */
function sanitize($input) {
    if (is_array($input)) {
        return array_map('sanitize', $input);
    }
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

/**
 * Generate random string
 */
function generateRandomString($length = 32) {
    return bin2hex(random_bytes($length / 2));
}

/**
 * Format currency
 */
function formatCurrency($amount, $currency = 'RM') {
    return $currency . ' ' . number_format($amount, 2);
}

/**
 * Get stock status label and color
 */
function getStockStatus($quantity, $thresholds = null) {
    $critical = $thresholds['critical'] ?? DEFAULT_CRITICAL;
    $low = $thresholds['low'] ?? DEFAULT_LOW;
    $overstock = $thresholds['overstock'] ?? DEFAULT_OVERSTOCK;
    
    if ($quantity <= $critical) {
        return ['status' => 'critical', 'label' => '⚠️ Critical', 'color' => '#e74c3c'];
    } elseif ($quantity <= $low) {
        return ['status' => 'low', 'label' => '🔶 Low', 'color' => '#f39c12'];
    } elseif ($quantity >= $overstock) {
        return ['status' => 'overstock', 'label' => '📦 Overstock', 'color' => '#3498db'];
    } else {
        return ['status' => 'normal', 'label' => '✅ Normal', 'color' => '#27ae60'];
    }
}

/**
 * Get warehouse by role
 */
function getWarehouseIdByRole($role) {
    $warehouse_map = [
        'admin_kaftanasia' => 1,
        'admin_astech' => 2
    ];
    return $warehouse_map[$role] ?? null;
}

/**
 * Log activity
 */
function logActivity($user_id, $action, $entity_type = null, $entity_id = null, $old_values = null, $new_values = null) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        
        $stmt->execute([
            $user_id,
            $action,
            $entity_type,
            $entity_id,
            $old_values ? json_encode($old_values) : null,
            $new_values ? json_encode($new_values) : null,
            $ip,
            $user_agent
        ]);
        
        return true;
    } catch (Exception $e) {
        error_log("Activity log error: " . $e->getMessage());
        return false;
    }
}

/**
 * Get user by ID
 */
function getUserById($id) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT id, email, full_name, role FROM users WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

/**
 * Check if user has permission
 */
function userCan($permission) {
    global $auth;
    if (!$auth->isLoggedIn()) return false;
    $user = $auth->getCurrentUser();
    return RolePermissions::hasPermission($user['role'], $permission);
}

/**
 * Get product details
 */
function getProductDetails($variant_id) {
    global $pdo;
    $stmt = $pdo->prepare("
        SELECT 
            pv.id as variant_id,
            pv.variant_name,
            pv.variant_sku,
            pv.price,
            mp.id as product_id,
            mp.name as product_name,
            mp.sku as product_sku,
            mp.category,
            mp.brand,
            mp.description
        FROM product_variants pv
        JOIN master_products mp ON pv.master_product_id = mp.id
        WHERE pv.id = ?
    ");
    $stmt->execute([$variant_id]);
    return $stmt->fetch();
}

/**
 * Get inventory with details
 */
function getInventoryWithDetails($warehouse_id = null, $product_id = null) {
    global $pdo;
    
    $sql = "
        SELECT 
            i.*,
            pv.variant_name,
            pv.variant_sku,
            pv.price as variant_price,
            mp.name as product_name,
            mp.sku as product_sku,
            mp.category,
            mp.brand,
            w.name as warehouse_name,
            st.critical_level,
            st.low_level,
            st.overstock_level
        FROM inventory i
        JOIN product_variants pv ON i.product_variant_id = pv.id
        JOIN master_products mp ON pv.master_product_id = mp.id
        JOIN warehouses w ON i.warehouse_id = w.id
        LEFT JOIN stock_thresholds st ON i.product_variant_id = st.product_variant_id 
            AND i.warehouse_id = st.warehouse_id
        WHERE 1=1
    ";
    
    $params = [];
    
    if ($warehouse_id) {
        $sql .= " AND i.warehouse_id = ?";
        $params[] = $warehouse_id;
    }
    
    if ($product_id) {
        $sql .= " AND mp.id = ?";
        $params[] = $product_id;
    }
    
    $sql .= " ORDER BY mp.name ASC, pv.variant_name ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/**
 * JSON response helper
 */
function jsonResponse($data, $status_code = 200) {
    http_response_code($status_code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Error handler for API
 */
function apiError($message, $status_code = 400) {
    jsonResponse(['success' => false, 'error' => $message], $status_code);
}

/**
 * Create slug from string
 */
function createSlug($string) {
    $string = strtolower($string);
    $string = preg_replace('/[^a-z0-9-]/', '-', $string);
    $string = preg_replace('/-+/', '-', $string);
    return trim($string, '-');
}

/**
 * Get month name
 */
function getMonthName($month_num) {
    $months = [
        1 => 'January', 2 => 'February', 3 => 'March',
        4 => 'April', 5 => 'May', 6 => 'June',
        7 => 'July', 8 => 'August', 9 => 'September',
        10 => 'October', 11 => 'November', 12 => 'December'
    ];
    return $months[$month_num] ?? '';
}

/**
 * Format date
 */
function formatDate($date, $format = 'Y-m-d H:i:s') {
    if (!$date) return '-';
    $timestamp = is_numeric($date) ? $date : strtotime($date);
    return date($format, $timestamp);
}

/**
 * Time ago in words
 */
function timeAgo($timestamp) {
    $time_ago = strtotime($timestamp);
    $current_time = time();
    $time_difference = $current_time - $time_ago;
    $seconds = $time_difference;
    
    $minutes = round($seconds / 60);
    $hours = round($seconds / 3600);
    $days = round($seconds / 86400);
    $weeks = round($seconds / 604800);
    $months = round($seconds / 2629440);
    $years = round($seconds / 31553280);
    
    if ($seconds <= 60) {
        return "Just Now";
    } elseif ($minutes <= 60) {
        return ($minutes == 1) ? "1 minute ago" : "$minutes minutes ago";
    } elseif ($hours <= 24) {
        return ($hours == 1) ? "1 hour ago" : "$hours hours ago";
    } elseif ($days <= 7) {
        return ($days == 1) ? "Yesterday" : "$days days ago";
    } elseif ($weeks <= 4.3) {
        return ($weeks == 1) ? "1 week ago" : "$weeks weeks ago";
    } elseif ($months <= 12) {
        return ($months == 1) ? "1 month ago" : "$months months ago";
    } else {
        return ($years == 1) ? "1 year ago" : "$years years ago";
    }
}