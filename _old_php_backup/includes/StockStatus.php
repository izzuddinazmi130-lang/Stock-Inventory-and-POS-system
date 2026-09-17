<?php
// includes/StockStatus.php
class StockStatus {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }
    
    public function calculateStatus($current_stock, $product_id, $warehouse_id) {
        // Get thresholds for this product
        $stmt = $this->db->prepare("
            SELECT critical_level, low_level, overstock_level 
            FROM stock_thresholds 
            WHERE product_variant_id = ? AND warehouse_id = ?
        ");
        $stmt->execute([$product_id, $warehouse_id]);
        $thresholds = $stmt->fetch();
        
        if (!$thresholds) {
            // Default thresholds
            $critical = 2;
            $low = 10;
            $overstock = 100;
        } else {
            $critical = $thresholds['critical_level'];
            $low = $thresholds['low_level'];
            $overstock = $thresholds['overstock_level'];
        }
        
        // Determine status
        if ($current_stock <= $critical) {
            $status = 'critical';
        } elseif ($current_stock <= $low) {
            $status = 'low';
        } elseif ($current_stock >= $overstock) {
            $status = 'overstock';
        } else {
            $status = 'normal';
        }
        
        // Log status change
        $this->logStatus($product_id, $warehouse_id, $status, $current_stock);
        
        return [
            'status' => $status,
            'color' => $this->getColor($status),
            'label' => $this->getLabel($status),
            'current_stock' => $current_stock,
            'thresholds' => [
                'critical' => $critical,
                'low' => $low,
                'overstock' => $overstock
            ]
        ];
    }
    
    private function logStatus($product_id, $warehouse_id, $status, $quantity) {
        // Get previous status
        $stmt = $this->db->prepare("
            SELECT status FROM stock_status_log 
            WHERE product_variant_id = ? AND warehouse_id = ?
            ORDER BY checked_at DESC LIMIT 1
        ");
        $stmt->execute([$product_id, $warehouse_id]);
        $previous = $stmt->fetch();
        
        $previous_status = $previous ? $previous['status'] : null;
        
        // Only log if status changed
        if ($previous_status !== $status) {
            $stmt = $this->db->prepare("
                INSERT INTO stock_status_log (
                    product_variant_id, warehouse_id, status,
                    previous_status, quantity_at_check,
                    threshold_low, threshold_critical
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            
            // Get thresholds
            $stmt2 = $this->db->prepare("
                SELECT low_level, critical_level 
                FROM stock_thresholds 
                WHERE product_variant_id = ? AND warehouse_id = ?
            ");
            $stmt2->execute([$product_id, $warehouse_id]);
            $thresholds = $stmt2->fetch();
            
            $low = $thresholds ? $thresholds['low_level'] : 10;
            $critical = $thresholds ? $thresholds['critical_level'] : 2;
            
            $stmt->execute([
                $product_id,
                $warehouse_id,
                $status,
                $previous_status,
                $quantity,
                $low,
                $critical
            ]);
        }
    }
    
    private function getColor($status) {
        $colors = [
            'critical' => '#e74c3c',
            'low' => '#f39c12',
            'normal' => '#27ae60',
            'overstock' => '#3498db'
        ];
        return $colors[$status] ?? '#95a5a6';
    }
    
    private function getLabel($status) {
        $labels = [
            'critical' => '⚠️ Critical Stock',
            'low' => '🔶 Low Stock',
            'normal' => '✅ Normal Stock',
            'overstock' => '📦 Overstock'
        ];
        return $labels[$status] ?? 'Unknown';
    }
    
    public function getStatusSummary($warehouse_id) {
        $stmt = $this->db->prepare("
            SELECT 
                COUNT(CASE WHEN quantity <= 2 THEN 1 END) as critical,
                COUNT(CASE WHEN quantity > 2 AND quantity <= 10 THEN 1 END) as low,
                COUNT(CASE WHEN quantity > 10 AND quantity < 100 THEN 1 END) as normal,
                COUNT(CASE WHEN quantity >= 100 THEN 1 END) as overstock
            FROM inventory
            WHERE warehouse_id = ?
        ");
        $stmt->execute([$warehouse_id]);
        return $stmt->fetch();
    }
    
    public function getLowStockItems($warehouse_id, $limit = 20) {
        $stmt = $this->db->prepare("
            SELECT 
                pv.id,
                pv.variant_name,
                pv.variant_sku,
                mp.name as product_name,
                i.quantity as current_stock,
                st.low_level,
                st.critical_level
            FROM product_variants pv
            JOIN master_products mp ON pv.master_product_id = mp.id
            JOIN inventory i ON i.product_variant_id = pv.id AND i.warehouse_id = pv.warehouse_id
            LEFT JOIN stock_thresholds st ON st.product_variant_id = pv.id AND st.warehouse_id = pv.warehouse_id
            WHERE pv.warehouse_id = ? 
                AND i.quantity <= IFNULL(st.low_level, 10)
            ORDER BY i.quantity ASC
            LIMIT ?
        ");
        $stmt->execute([$warehouse_id, $limit]);
        return $stmt->fetchAll();
    }
}