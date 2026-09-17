<?php
/**
 * API: Stock Inventory Management
 * Full real database-backed operations for Astech Kedai PC and Kaftan Asia Exclusive.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/sessionManager.php';

SessionManager::start();

try {
    $db = Database::getInstance()->getConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

$currentUser = SessionManager::getUser();

// Determine warehouse
$warehouseId = null;
if (isset($_GET['warehouse_id'])) {
    $warehouseId = (int)$_GET['warehouse_id'];
} elseif (isset($_POST['warehouse_id'])) {
    $warehouseId = (int)$_POST['warehouse_id'];
}

$rawInput = file_get_contents('php://input');
$jsonData = json_decode($rawInput, true);
if (!$warehouseId && is_array($jsonData) && isset($jsonData['warehouse_id'])) {
    $warehouseId = (int)$jsonData['warehouse_id'];
}

if (!$warehouseId && $currentUser) {
    $warehouseId = !empty($currentUser['warehouse_id']) ? (int)$currentUser['warehouse_id'] : null;
    if (!$warehouseId && !empty($currentUser['assigned_warehouse_id'])) {
        $warehouseId = (int)$currentUser['assigned_warehouse_id'];
    }
    if (!$warehouseId && !empty($currentUser['role'])) {
        if ($currentUser['role'] === 'admin_kaftanasia' || $currentUser['role'] === 'stock_manager_kaftan') {
            $warehouseId = 1;
        } elseif ($currentUser['role'] === 'admin_astech' || $currentUser['role'] === 'stock_manager_astech') {
            $warehouseId = 2;
        }
    }
}

if (!$warehouseId) {
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    if (stripos($referer, 'kaftan') !== false) {
        $warehouseId = 1;
    } else {
        $warehouseId = 2;
    }
}

function getStoreDetails($db, $warehouseId) {
    $stmt = $db->prepare('SELECT id, name, code, description FROM warehouses WHERE id = ?');
    $stmt->execute([$warehouseId]);
    $store = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$store) {
        $store = [
            'id' => $warehouseId,
            'name' => $warehouseId == 1 ? 'Kaftan Asia Exclusive' : 'Astech Kedai PC',
            'code' => $warehouseId == 1 ? 'KW' : 'AW'
        ];
    }
    return $store;
}

function fetchInventoryPayload($db, $warehouseId) {
    $store = getStoreDetails($db, $warehouseId);

    $stmt = $db->prepare("
        SELECT 
            id,
            warehouse_id,
            item_code,
            item_code AS sku,
            item_name,
            item_type,
            category,
            variant_color,
            size,
            unit_price,
            selling_price,
            quantity,
            minimum_quantity,
            CASE 
                WHEN quantity <= 0 THEN 0
                WHEN quantity <= minimum_quantity THEN 1 
                ELSE 0 
            END AS is_low_stock,
            image_url,
            pc_brand,
            pc_device_type,
            pc_model,
            panel_type,
            port_interface,
            screen_size,
            graphics_chipset,
            storage_capacity,
            storage_type,
            processor_type,
            component_profile,
            component_specs_json,
            DATE_FORMAT(last_movement_at, '%Y-%m-%d %H:%i:%s') AS last_movement_at,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
        FROM stock_items
        WHERE warehouse_id = ? AND is_active = 1
        ORDER BY id DESC
    ");
    $stmt->execute([$warehouseId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as &$it) {
        $it['id'] = (int)$it['id'];
        $it['warehouse_id'] = (int)$it['warehouse_id'];
        $it['quantity'] = (int)$it['quantity'];
        $it['minimum_quantity'] = (int)$it['minimum_quantity'];
        $it['unit_price'] = (float)$it['unit_price'];
        $it['selling_price'] = (float)$it['selling_price'];
        $it['is_low_stock'] = (int)$it['is_low_stock'];
    }
    unset($it);

    $totalItems = count($items);
    $totalUnits = 0;
    $lowStock = 0;
    $outStock = 0;
    foreach ($items as $it) {
        $totalUnits += $it['quantity'];
        if ($it['quantity'] <= 0) {
            $outStock++;
        } elseif ($it['quantity'] <= $it['minimum_quantity']) {
            $lowStock++;
        }
    }

    $stats = [
        'total_items' => $totalItems,
        'total_units' => $totalUnits,
        'low_stock_items' => $lowStock,
        'out_of_stock' => $outStock
    ];

    $stmt = $db->prepare('SELECT DISTINCT name FROM stock_categories WHERE warehouse_id = ? ORDER BY name ASC');
    $stmt->execute([$warehouseId]);
    $cats = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $itemCats = array_unique(array_filter(array_column($items, 'category')));
    $allCats = array_values(array_unique(array_merge($cats, $itemCats)));
    sort($allCats);

    return [
        'store' => $store,
        'stats' => $stats,
        'items' => $items,
        'categories' => $allCats
    ];
}

$action = $_GET['action'] ?? ($jsonData['action'] ?? ($_POST['action'] ?? 'get_inventory'));

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'get_history') {
        $stmt = $db->prepare("
            SELECT 
                m.id,
                m.warehouse_id,
                m.item_id,
                m.movement_type,
                m.quantity,
                m.qty_before,
                m.qty_after,
                m.unit_price,
                m.selling_price,
                m.note,
                DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                i.item_code,
                i.item_name,
                i.item_type,
                i.category,
                i.variant_color,
                i.image_url
            FROM stock_movements m
            JOIN stock_items i ON m.item_id = i.id
            WHERE m.warehouse_id = ?
            ORDER BY m.id DESC
            LIMIT 200
        ");
        $stmt->execute([$warehouseId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'movements' => $rows]);
        exit;
    }

    if ($action === 'get_returns_damage') {
        $stmt = $db->prepare("
            SELECT 
                rd.id,
                rd.warehouse_id,
                rd.item_id,
                rd.record_type,
                rd.qty,
                rd.qty_before,
                rd.qty_after,
                rd.note,
                DATE_FORMAT(rd.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                i.item_code,
                i.item_name,
                i.item_type,
                i.category,
                i.variant_color,
                i.image_url
            FROM stock_returns_damage rd
            JOIN stock_items i ON rd.item_id = i.id
            WHERE rd.warehouse_id = ?
            ORDER BY rd.id DESC
            LIMIT 200
        ");
        $stmt->execute([$warehouseId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'records' => $rows]);
        exit;
    }

    if ($action === 'get_analytics') {
        $stmt = $db->prepare('
            SELECT 
                COALESCE(SUM(quantity * unit_price), 0) AS total_cost_value,
                COALESCE(SUM(quantity * selling_price), 0) AS total_sell_value,
                COUNT(CASE WHEN quantity <= 0 THEN 1 END) AS out_of_stock,
                COUNT(CASE WHEN quantity > 0 AND quantity <= minimum_quantity THEN 1 END) AS low_stock
            FROM stock_items
            WHERE warehouse_id = ? AND is_active = 1
        ');
        $stmt->execute([$warehouseId]);
        $kpiRaw = $stmt->fetch(PDO::FETCH_ASSOC);
        $totalCost = (float)$kpiRaw['total_cost_value'];
        $totalSell = (float)$kpiRaw['total_sell_value'];
        $potentialProfit = $totalSell - $totalCost;

        $kpi = [
            'total_cost_value' => $totalCost,
            'total_sell_value' => $totalSell,
            'potential_profit' => $potentialProfit,
            'low_stock' => (int)$kpiRaw['low_stock'],
            'out_of_stock' => (int)$kpiRaw['out_of_stock'],
        ];

        $stmt = $db->prepare('
            SELECT 
                category,
                SUM(quantity) AS total_qty,
                COUNT(*) AS item_count
            FROM stock_items
            WHERE warehouse_id = ? AND is_active = 1
            GROUP BY category
            ORDER BY total_qty DESC
        ');
        $stmt->execute([$warehouseId]);
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($categories as &$c) {
            $c['total_qty'] = (int)$c['total_qty'];
            $c['item_count'] = (int)$c['item_count'];
        }
        unset($c);

        $stmt = $db->prepare('
            SELECT 
                id, item_code, item_name, item_type, category, variant_color, quantity
            FROM stock_items
            WHERE warehouse_id = ? AND is_active = 1
            ORDER BY quantity DESC
            LIMIT 5
        ');
        $stmt->execute([$warehouseId]);
        $topItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($topItems as &$t) {
            $t['quantity'] = (int)$t['quantity'];
        }
        unset($t);

        $stmt = $db->prepare('
            SELECT 
                movement_type,
                COUNT(*) AS count,
                COALESCE(SUM(quantity), 0) AS total_qty
            FROM stock_movements
            WHERE warehouse_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY movement_type
        ');
        $stmt->execute([$warehouseId]);
        $moveRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $movements = [
            'in' => ['count' => 0, 'total_qty' => 0],
            'out' => ['count' => 0, 'total_qty' => 0],
            'adjust' => ['count' => 0, 'total_qty' => 0],
        ];
        foreach ($moveRows as $mr) {
            $type = $mr['movement_type'];
            if (isset($movements[$type])) {
                $movements[$type] = [
                    'count' => (int)$mr['count'],
                    'total_qty' => (int)$mr['total_qty']
                ];
            }
        }

        $stmt = $db->prepare('
            SELECT 
                record_type,
                COUNT(*) AS count,
                COALESCE(SUM(qty), 0) AS total_qty
            FROM stock_returns_damage
            WHERE warehouse_id = ?
            GROUP BY record_type
        ');
        $stmt->execute([$warehouseId]);
        $rdRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $rdSummary = [
            'return' => ['count' => 0, 'total_qty' => 0],
            'damage' => ['count' => 0, 'total_qty' => 0],
        ];
        foreach ($rdRows as $rdr) {
            $type = $rdr['record_type'];
            if (isset($rdSummary[$type])) {
                $rdSummary[$type] = [
                    'count' => (int)$rdr['count'],
                    'total_qty' => (int)$rdr['total_qty']
                ];
            }
        }

        $stmt = $db->prepare("
            SELECT 
                i.item_code, i.item_name, i.item_type, i.category, i.variant_color,
                SUM(m.quantity) AS total_in
            FROM stock_movements m
            JOIN stock_items i ON m.item_id = i.id
            WHERE m.warehouse_id = ? AND m.movement_type = 'in' AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY m.item_id
            ORDER BY total_in DESC
            LIMIT 5
        ");
        $stmt->execute([$warehouseId]);
        $topStockIn = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($topStockIn as &$tsi) {
            $tsi['total_in'] = (int)$tsi['total_in'];
        }
        unset($tsi);

        $stmt = $db->prepare("
            SELECT 
                i.item_code, i.item_name, i.item_type, i.category, i.variant_color,
                SUM(m.quantity) AS total_out
            FROM stock_movements m
            JOIN stock_items i ON m.item_id = i.id
            WHERE m.warehouse_id = ? AND m.movement_type = 'out' AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY m.item_id
            ORDER BY total_out DESC
            LIMIT 5
        ");
        $stmt->execute([$warehouseId]);
        $topStockOut = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($topStockOut as &$tso) {
            $tso['total_out'] = (int)$tso['total_out'];
        }
        unset($tso);

        echo json_encode([
            'success' => true,
            'kpi' => $kpi,
            'categories' => $categories,
            'top_items' => $topItems,
            'movements' => $movements,
            'rd_summary' => $rdSummary,
            'top_stock_in' => $topStockIn,
            'top_stock_out' => $topStockOut
        ]);
        exit;
    }

    $data = fetchInventoryPayload($db, $warehouseId);
    echo json_encode(['success' => true, 'inventory' => $data]);
    exit;
}

$input = is_array($jsonData) ? $jsonData : $_POST;

if ($action === 'create_item') {
    $itemCode = trim($input['item_code'] ?? '');
    $itemName = trim($input['item_name'] ?? '');
    $itemType = trim($input['item_type'] ?? '');
    $category = trim($input['category'] ?? '');
    $variantColor = trim($input['variant_color'] ?? '');
    $size = trim($input['size'] ?? '');
    $unitPrice = (float)($input['unit_price'] ?? 0);
    $sellingPrice = (float)($input['selling_price'] ?? 0);
    $quantity = (int)($input['quantity'] ?? 0);
    $minimumQuantity = (int)($input['minimum_quantity'] ?? 0);
    $imageUrl = trim($input['image_url'] ?? '');

    $pcBrand = trim($input['pc_brand'] ?? '');
    $pcDeviceType = trim($input['pc_device_type'] ?? '');
    $pcModel = trim($input['pc_model'] ?? '');
    $panelType = trim($input['panel_type'] ?? '');
    $portInterface = trim($input['port_interface'] ?? '');
    $screenSize = trim($input['screen_size'] ?? '');
    $graphicsChipset = trim($input['graphics_chipset'] ?? '');
    $storageCapacity = trim($input['storage_capacity'] ?? '');
    $storageType = trim($input['storage_type'] ?? '');
    $processorType = trim($input['processor_type'] ?? '');

    $componentProfile = trim($input['component_profile'] ?? '');
    $componentSpecs = trim($input['component_specs_json'] ?? '');

    if (empty($itemName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nama item tidak boleh kosong.']);
        exit;
    }

    if (empty($itemCode)) {
        $prefix = $warehouseId == 1 ? 'KA' : 'AS';
        $typeLetter = strtoupper(substr($itemType ?: 'I', 0, 1));
        $maxNum = $db->query("SELECT COUNT(*) FROM stock_items WHERE warehouse_id = $warehouseId")->fetchColumn();
        $itemCode = sprintf('%s-%s%d', $prefix, $typeLetter, $maxNum + 1);
    }

    $checkStmt = $db->prepare('SELECT id FROM stock_items WHERE warehouse_id = ? AND item_code = ?');
    $checkStmt->execute([$warehouseId, $itemCode]);
    if ($checkStmt->fetch()) {
        $itemCode .= '-' . time();
    }

    $stmt = $db->prepare('
        INSERT INTO stock_items (
            warehouse_id, item_code, item_name, item_type, category, variant_color, size,
            unit_price, selling_price, quantity, minimum_quantity, image_url,
            pc_brand, pc_device_type, pc_model, panel_type, port_interface, screen_size,
            graphics_chipset, storage_capacity, storage_type, processor_type,
            component_profile, component_specs_json, last_movement_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?
        )
    ');

    $lastMovement = $quantity > 0 ? date('Y-m-d H:i:s') : null;
    $stmt->execute([
        $warehouseId, $itemCode, $itemName, $itemType, $category, $variantColor, $size,
        $unitPrice, $sellingPrice, $quantity, $minimumQuantity, $imageUrl,
        $pcBrand, $pcDeviceType, $pcModel, $panelType, $portInterface, $screenSize,
        $graphicsChipset, $storageCapacity, $storageType, $processorType,
        $componentProfile, $componentSpecs, $lastMovement
    ]);
    $newId = (int)$db->lastInsertId();

    if ($quantity > 0) {
        $mvStmt = $db->prepare("
            INSERT INTO stock_movements (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note)
            VALUES (?, ?, 'in', ?, 0, ?, ?, ?, 'Kemasukan stok awal')
        ");
        $mvStmt->execute([$warehouseId, $newId, $quantity, $quantity, $unitPrice, $sellingPrice]);
    }

    if (!empty($category)) {
        $catStmt = $db->prepare('INSERT IGNORE INTO stock_categories (warehouse_id, name, type) VALUES (?, ?, ?)');
        $catStmt->execute([$warehouseId, $category, $itemType]);
    }

    $updatedInventory = fetchInventoryPayload($db, $warehouseId);
    echo json_encode([
        'success' => true,
        'message' => 'Item berjaya ditambah: ' . $itemCode,
        'inventory' => $updatedInventory
    ]);
    exit;
}

if ($action === 'update_item') {
    $itemId = (int)($input['item_id'] ?? 0);
    if (!$itemId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Item ID diperlukan.']);
        exit;
    }

    $itemName = trim($input['item_name'] ?? '');
    $itemType = trim($input['item_type'] ?? '');
    $category = trim($input['category'] ?? '');
    $variantColor = trim($input['variant_color'] ?? '');
    $size = trim($input['size'] ?? '');
    $unitPrice = (float)($input['unit_price'] ?? 0);
    $sellingPrice = (float)($input['selling_price'] ?? 0);
    $minimumQuantity = (int)($input['minimum_quantity'] ?? 0);
    $imageUrl = trim($input['image_url'] ?? '');

    $pcBrand = trim($input['pc_brand'] ?? '');
    $pcDeviceType = trim($input['pc_device_type'] ?? '');
    $pcModel = trim($input['pc_model'] ?? '');
    $panelType = trim($input['panel_type'] ?? '');
    $portInterface = trim($input['port_interface'] ?? '');
    $screenSize = trim($input['screen_size'] ?? '');
    $graphicsChipset = trim($input['graphics_chipset'] ?? '');
    $storageCapacity = trim($input['storage_capacity'] ?? '');
    $storageType = trim($input['storage_type'] ?? '');
    $processorType = trim($input['processor_type'] ?? '');

    $componentProfile = trim($input['component_profile'] ?? '');
    $componentSpecs = trim($input['component_specs_json'] ?? '');

    $stmt = $db->prepare('
        UPDATE stock_items SET
            item_name = ?,
            item_type = ?,
            category = ?,
            variant_color = ?,
            size = ?,
            unit_price = ?,
            selling_price = ?,
            minimum_quantity = ?,
            image_url = ?,
            pc_brand = ?,
            pc_device_type = ?,
            pc_model = ?,
            panel_type = ?,
            port_interface = ?,
            screen_size = ?,
            graphics_chipset = ?,
            storage_capacity = ?,
            storage_type = ?,
            processor_type = ?,
            component_profile = ?,
            component_specs_json = ?
        WHERE id = ? AND warehouse_id = ?
    ');

    $stmt->execute([
        $itemName, $itemType, $category, $variantColor, $size,
        $unitPrice, $sellingPrice, $minimumQuantity, $imageUrl,
        $pcBrand, $pcDeviceType, $pcModel, $panelType, $portInterface, $screenSize,
        $graphicsChipset, $storageCapacity, $storageType, $processorType,
        $componentProfile, $componentSpecs,
        $itemId, $warehouseId
    ]);

    if (!empty($category)) {
        $catStmt = $db->prepare('INSERT IGNORE INTO stock_categories (warehouse_id, name, type) VALUES (?, ?, ?)');
        $catStmt->execute([$warehouseId, $category, $itemType]);
    }

    $updatedInventory = fetchInventoryPayload($db, $warehouseId);
    echo json_encode([
        'success' => true,
        'message' => 'Item berjaya dikemaskini.',
        'inventory' => $updatedInventory
    ]);
    exit;
}

if ($action === 'delete_item') {
    $itemId = (int)($input['item_id'] ?? 0);
    if (!$itemId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Item ID diperlukan.']);
        exit;
    }

    $stmt = $db->prepare('DELETE FROM stock_items WHERE id = ? AND warehouse_id = ?');
    $stmt->execute([$itemId, $warehouseId]);

    $db->prepare('DELETE FROM stock_movements WHERE item_id = ?')->execute([$itemId]);
    $db->prepare('DELETE FROM stock_returns_damage WHERE item_id = ?')->execute([$itemId]);

    $updatedInventory = fetchInventoryPayload($db, $warehouseId);
    echo json_encode([
        'success' => true,
        'message' => 'Item berjaya dipadam.',
        'inventory' => $updatedInventory
    ]);
    exit;
}

if ($action === 'adjust_stock') {
    $itemId = (int)($input['item_id'] ?? 0);
    $movementType = strtolower(trim($input['movement_type'] ?? 'in'));
    $qty = (int)($input['qty'] ?? 0);
    $note = trim($input['note'] ?? '');

    if (!$itemId || $qty <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Kuantiti mesti lebih besar dari 0.']);
        exit;
    }

    $stmt = $db->prepare('SELECT quantity, unit_price, selling_price FROM stock_items WHERE id = ? AND warehouse_id = ?');
    $stmt->execute([$itemId, $warehouseId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$item) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Item tidak ditemui.']);
        exit;
    }

    $qtyBefore = (int)$item['quantity'];
    $qtyAfter = $movementType === 'out' ? max(0, $qtyBefore - $qty) : $qtyBefore + $qty;

    $updStmt = $db->prepare('UPDATE stock_items SET quantity = ?, last_movement_at = NOW() WHERE id = ?');
    $updStmt->execute([$qtyAfter, $itemId]);

    $logStmt = $db->prepare('
        INSERT INTO stock_movements (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $logStmt->execute([
        $warehouseId, $itemId, $movementType, $qty, $qtyBefore, $qtyAfter,
        $item['unit_price'], $item['selling_price'], $note
    ]);

    $updatedInventory = fetchInventoryPayload($db, $warehouseId);
    echo json_encode([
        'success' => true,
        'message' => 'Stok berjaya dikemaskini. Jumlah terkini: ' . $qtyAfter,
        'inventory' => $updatedInventory
    ]);
    exit;
}

if ($action === 'adjust_stock_bulk') {
    $movementType = strtolower(trim($input['movement_type'] ?? 'in'));
    $note = trim($input['note'] ?? 'QR bulk adjustment');
    $items = $input['items'] ?? [];

    if (!is_array($items) || empty($items)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Tiada item untuk diproses.']);
        exit;
    }

    $processed = 0;
    foreach ($items as $entry) {
        $itemId = (int)($entry['item_id'] ?? 0);
        $qty = (int)($entry['qty'] ?? 0);
        if (!$itemId || $qty <= 0) continue;

        $stmt = $db->prepare('SELECT quantity, unit_price, selling_price FROM stock_items WHERE id = ? AND warehouse_id = ?');
        $stmt->execute([$itemId, $warehouseId]);
        $it = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$it) continue;

        $qtyBefore = (int)$it['quantity'];
        $qtyAfter = $movementType === 'out' ? max(0, $qtyBefore - $qty) : $qtyBefore + $qty;

        $db->prepare('UPDATE stock_items SET quantity = ?, last_movement_at = NOW() WHERE id = ?')
           ->execute([$qtyAfter, $itemId]);

        $db->prepare('
            INSERT INTO stock_movements (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $warehouseId, $itemId, $movementType, $qty, $qtyBefore, $qtyAfter,
            $it['unit_price'], $it['selling_price'], $note
        ]);

        $processed++;
    }

    $updatedInventory = fetchInventoryPayload($db, $warehouseId);
    echo json_encode([
        'success' => true,
        'message' => "Stok berjaya dikemaskini bagi $processed item.",
        'inventory' => $updatedInventory
    ]);
    exit;
}

if ($action === 'add_return_damage') {
    $itemId = (int)($input['item_id'] ?? 0);
    $recordType = strtolower(trim($input['record_type'] ?? 'return'));
    $qty = (int)($input['qty'] ?? 0);
    $note = trim($input['note'] ?? '');

    if (!$itemId || $qty <= 0 || !in_array($recordType, ['return', 'damage'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Parameter return/damage tidak sah.']);
        exit;
    }

    $stmt = $db->prepare('SELECT quantity, unit_price, selling_price FROM stock_items WHERE id = ? AND warehouse_id = ?');
    $stmt->execute([$itemId, $warehouseId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$item) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Item tidak ditemui.']);
        exit;
    }

    $qtyBefore = (int)$item['quantity'];
    $qtyAfter = $recordType === 'return' ? $qtyBefore + $qty : max(0, $qtyBefore - $qty);

    $db->prepare('UPDATE stock_items SET quantity = ?, last_movement_at = NOW() WHERE id = ?')
       ->execute([$qtyAfter, $itemId]);

    $db->prepare('
        INSERT INTO stock_returns_damage (warehouse_id, item_id, record_type, qty, qty_before, qty_after, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $warehouseId, $itemId, $recordType, $qty, $qtyBefore, $qtyAfter, $note
    ]);

    $mvType = $recordType === 'return' ? 'in' : 'out';
    $mvNote = ($recordType === 'return' ? '[Return] ' : '[Damage] ') . $note;
    $db->prepare('
        INSERT INTO stock_movements (warehouse_id, item_id, movement_type, quantity, qty_before, qty_after, unit_price, selling_price, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $warehouseId, $itemId, $mvType, $qty, $qtyBefore, $qtyAfter,
        $item['unit_price'], $item['selling_price'], $mvNote
    ]);

    $updatedInventory = fetchInventoryPayload($db, $warehouseId);
    echo json_encode([
        'success' => true,
        'message' => 'Rekod ' . $recordType . ' berjaya disimpan.',
        'inventory' => $updatedInventory
    ]);
    exit;
}

if ($action === 'manage_categories') {
    $categoryName = trim($input['name'] ?? '');
    $categoryType = trim($input['type'] ?? '');
    $subAction = $input['sub_action'] ?? 'add';

    if (empty($categoryName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nama kategori tidak boleh kosong.']);
        exit;
    }

    if ($subAction === 'delete') {
        $stmt = $db->prepare('DELETE FROM stock_categories WHERE warehouse_id = ? AND name = ?');
        $stmt->execute([$warehouseId, $categoryName]);
    } else {
        $stmt = $db->prepare('INSERT IGNORE INTO stock_categories (warehouse_id, name, type) VALUES (?, ?, ?)');
        $stmt->execute([$warehouseId, $categoryName, $categoryType]);
    }

    $updatedInventory = fetchInventoryPayload($db, $warehouseId);
    echo json_encode([
        'success' => true,
        'message' => 'Kategori berjaya dikemaskini.',
        'inventory' => $updatedInventory
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Aksi tidak sah: ' . htmlspecialchars($action)]);
