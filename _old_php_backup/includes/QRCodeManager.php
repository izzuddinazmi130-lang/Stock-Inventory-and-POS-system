<?php
/**
 * QR Code Manager using SvgWriter (independent of PHP GD)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../vendor/autoload.php';

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\SvgWriter;

class QRCodeManager {
    private $db;
    private $qr_dir;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
        $this->qr_dir = __DIR__ . '/../assets/qr-codes/';
        if (!is_dir($this->qr_dir)) {
            @mkdir($this->qr_dir, 0755, true);
        }
    }

    public function generateQRForItem($itemId, $userId = 1) {
        try {
            $stmt = $this->db->prepare("SELECT s.*, w.name AS warehouse_name FROM stock_items s JOIN warehouses w ON s.warehouse_id = w.id WHERE s.id = ?");
            $stmt->execute([$itemId]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$item) {
                return ['error' => 'Product not found'];
            }

            $qrCodeString = 'HQ-ITEM-' . $item['warehouse_id'] . '-' . $item['item_code'];

            // Generate SVG QR
            $builder = new Builder(
                writer: new SvgWriter(),
                data: $qrCodeString,
                size: 260,
                margin: 10
            );
            $result = $builder->build();
            $svgContent = $result->getString();

            $filename = 'qr_' . $itemId . '_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $item['item_code']) . '.svg';
            $filepath = $this->qr_dir . $filename;
            @file_put_contents($filepath, $svgContent);

            return [
                'success' => true,
                'qr_code' => $qrCodeString,
                'qr_svg' => $svgContent,
                'file_url' => '../assets/qr-codes/' . $filename,
                'item' => $item
            ];
        } catch (Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    public function handleScanDeduct($qrCodeOrItemCode, $qty = 1, $userId = 1, $note = 'Physical store sale via QR', $warehouseId = null) {
        try {
            // Find item by item_code or raw QR code string
            $codeClean = trim($qrCodeOrItemCode);
            // If code is in format HQ-ITEM-{wh}-{item_code}
            if (preg_match('/^HQ-ITEM-\d+-(.+)$/', $codeClean, $m)) {
                $searchCode = $m[1];
            } else {
                $searchCode = $codeClean;
            }

            $stmt = $this->db->prepare("SELECT * FROM stock_items WHERE item_code = ? AND is_active = 1");
            $stmt->execute([$searchCode]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$item) {
                return ['success' => false, 'error' => "Product not found with code: {$searchCode}"];
            }

            if ($warehouseId && (int)$item['warehouse_id'] !== (int)$warehouseId) {
                return ['success' => false, 'error' => "Warehouse restriction: this item belongs to a different warehouse."];
            }

            $curQty = (int)$item['quantity'];
            if ($curQty < $qty) {
                return ['success' => false, 'error' => "Insufficient stock. Available: {$curQty}, requested: {$qty}"];
            }

            $this->db->beginTransaction();

            $newQty = $curQty - $qty;

            // Update item stock
            $stmt = $this->db->prepare("UPDATE stock_items SET quantity = ?, last_movement_at = NOW(), updated_at = NOW() WHERE id = ?");
            $stmt->execute([$newQty, $item['id']]);

            // Log movement
            $stmt = $this->db->prepare("
                INSERT INTO stock_movements 
                    (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note, performed_by, created_at)
                VALUES 
                    (?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $item['warehouse_id'],
                $item['id'],
                $qty,
                $curQty,
                $newQty,
                $item['unit_price'],
                $item['selling_price'],
                "[QR Scan] " . $note,
                $userId
            ]);

            $this->db->commit();

            return [
                'success' => true,
                'item' => $item,
                'qty_deducted' => $qty,
                'old_stock' => $curQty,
                'new_stock' => $newQty
            ];
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
