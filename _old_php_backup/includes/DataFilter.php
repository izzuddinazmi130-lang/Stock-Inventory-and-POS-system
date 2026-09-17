<?php
// includes/DataFilter.php
class DataFilter {
    
    public static function getWarehouseFilter() {
        $user_role = $_SESSION['user_role'] ?? null;
        $warehouse_id = $_SESSION['warehouse_id'] ?? null;
        
        switch ($user_role) {
            case 'super_admin':
                // Super Admin sees ALL warehouses (unless an explicit GET query is passed)
                if (isset($_GET['warehouse']) && in_array((int)$_GET['warehouse'], [1, 2])) {
                    return (int)$_GET['warehouse'];
                }
                return null; // No filter
                
            case 'admin_kaftanasia':
                // Only sees warehouse_id = 1
                return 1;
                
            case 'admin_astech':
                // Only sees warehouse_id = 2
                return 2;
                
            default:
                return $warehouse_id ? (int)$warehouse_id : null;
        }
    }
    
    public static function applyFilter($query, $table_alias = '') {
        $warehouse_filter = self::getWarehouseFilter();
        
        if ($warehouse_filter !== null) {
            $alias = $table_alias ? $table_alias . '.' : '';
            return $query . " AND {$alias}warehouse_id = $warehouse_filter";
        }
        
        return $query;
    }
}
