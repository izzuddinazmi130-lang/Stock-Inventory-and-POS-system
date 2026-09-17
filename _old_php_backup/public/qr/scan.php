<?php
/**
 * QR Code Scanner - Physical Store / Quick Stock Deduction
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/roles.php';
require_once __DIR__ . '/../../includes/QRCodeManager.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();
Auth::requireLogin();

$user = SessionManager::getUser();
$currentUserRole = $user['role'];
$userWarehouseId = $user['assigned_warehouse_id'] ?? $user['warehouse_id'] ?? null;

$db = Database::getInstance()->getConnection();

// AJAX Product Lookup by SKU or QR Code
if (isset($_GET['action']) && $_GET['action'] === 'lookup') {
    header('Content-Type: application/json');
    $code = trim($_GET['code'] ?? '');
    if (preg_match('/^HQ-ITEM-\d+-(.+)$/', $code, $m)) {
        $code = $m[1];
    }
    $stmt = $db->prepare("
        SELECT s.id, s.item_code, s.item_name, s.category, s.quantity, s.selling_price, s.warehouse_id, w.name AS warehouse_name 
        FROM stock_items s 
        JOIN warehouses w ON s.warehouse_id = w.id 
        WHERE s.item_code = ? AND s.is_active = 1
    ");
    $stmt->execute([$code]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($item) {
        echo json_encode(['success' => true, 'item' => $item]);
    } else {
        echo json_encode(['success' => false, 'message' => 'No active product found for code: ' . $code]);
    }
    exit;
}

$message = '';
$message_type = '';
$scan_result = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $qrCode = trim($_POST['qr_code'] ?? '');
    $qty = (int)($_POST['quantity'] ?? 1);
    $note = trim($_POST['note'] ?? 'Physical store sale / QR scan');

    if ($qrCode && $qty > 0) {
        $qrManager = new QRCodeManager();
        $targetWh = ($currentUserRole === 'super_admin') ? null : $userWarehouseId;
        $res = $qrManager->handleScanDeduct($qrCode, $qty, $user['id'] ?? 1, $note, $targetWh);

        if ($res['success']) {
            $scan_result = $res;
            $message = "Stock deducted successfully! Product: {$res['item']['item_code']} - {$res['item']['item_name']}. New balance: {$res['new_stock']}.";
            $message_type = 'success';
        } else {
            $message = $res['error'];
            $message_type = 'danger';
        }
    } else {
        $message = 'Please enter or scan a valid QR code and quantity.';
        $message_type = 'danger';
    }
}

$page_title = 'QR Code Scanner & Dispatch — HQ System';
require_once __DIR__ . '/../layout/header.php';
?>

<style>
/* Modern Scanner UI Styles */
.scanner-mode-switch {
    background: var(--bg-surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: 4px;
    display: flex;
    gap: 4px;
}
.btn-mode-tab {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
}
.btn-mode-tab:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.04);
}
.btn-mode-tab.active {
    background: var(--bg-elevated);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    border: 1px solid var(--border-strong);
}

/* Viewport with reticles & laser */
.scanner-viewport {
    position: relative;
    width: 100%;
    min-height: 320px;
    border-radius: 12px;
    overflow: hidden;
    background: #090d16;
    border: 1px solid var(--border-strong);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
#camera-reader {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
}
#camera-reader video {
    width: 100% !important;
    height: auto !important;
    border-radius: 12px;
    object-fit: cover;
}
.scan-laser {
    position: absolute;
    top: 15%;
    left: 8%;
    right: 8%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #38bdf8, #818cf8, transparent);
    box-shadow: 0 0 12px #38bdf8;
    animation: laserScan 2s ease-in-out infinite alternate;
    pointer-events: none;
    display: none;
    z-index: 15;
}
@keyframes laserScan {
    0% { top: 15%; }
    100% { top: 85%; }
}
.reticle-corner {
    position: absolute;
    width: 24px;
    height: 24px;
    border-color: #818cf8;
    border-style: solid;
    pointer-events: none;
    z-index: 12;
    display: none;
}
.reticle-tl { top: 16px; left: 16px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
.reticle-tr { top: 16px; right: 16px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
.reticle-bl { bottom: 16px; left: 16px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
.reticle-br { bottom: 16px; right: 16px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }

/* Upload Dropzone */
.qr-dropzone {
    border: 2px dashed var(--border-strong);
    border-radius: 12px;
    background: var(--bg-surface);
    padding: 36px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
}
.qr-dropzone:hover, .qr-dropzone.dragover {
    border-color: #818cf8;
    background: rgba(129, 140, 248, 0.06);
}
.qr-preview-box {
    max-height: 200px;
    border-radius: 8px;
    object-fit: contain;
    border: 1px solid var(--border-strong);
    background: #ffffff;
    padding: 4px;
}
</style>

<div class="main-wrapper d-flex">
    <?php require_once __DIR__ . '/../layout/sidebar.php'; ?>

    <main class="content-area flex-grow-1">
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h2>QR Code Scanner & Direct Dispatch</h2>
                <p class="subtitle">Live optical camera scanning and image upload deduction for point-of-sale or floor dispatch</p>
            </div>
            <div class="header-actions">
                <a href="<?php echo htmlspecialchars(app_url('qr/generate.php')); ?>" class="btn-modern btn-ghost">
                    <i class="fas fa-qrcode"></i> Generate QR
                </a>
                <a href="<?php echo htmlspecialchars(app_url('products/index.php')); ?>" class="btn-modern btn-ghost">
                    <i class="fas fa-boxes-stacked"></i> View Inventory
                </a>
            </div>
        </div>

        <?php if ($message): ?>
            <div class="alert alert-<?php echo $message_type === 'danger' ? 'danger bg-danger text-white' : 'success bg-success text-white'; ?> border-0 mb-4 d-flex align-items-center justify-content-between">
                <div>
                    <i class="fas fa-<?php echo $message_type === 'danger' ? 'circle-exclamation' : 'circle-check'; ?> me-2"></i>
                    <?php echo htmlspecialchars($message); ?>
                </div>
                <a href="scan.php" class="text-white text-decoration-none small opacity-75"><i class="fas fa-times"></i></a>
            </div>
        <?php endif; ?>

        <!-- Scan Feedback Banner -->
        <div id="scanFeedbackToast" style="display: none;" class="alert alert-success bg-success text-white border-0 mb-4 d-flex align-items-center justify-content-between shadow-sm">
            <div class="d-flex align-items-center gap-2">
                <i class="fas fa-circle-check fa-lg"></i>
                <div>
                    <strong>QR Code Detected:</strong> <span id="toastScannedCode" class="font-monospace fw-bold bg-dark px-2 py-1 rounded ms-1 text-warning"></span>
                </div>
            </div>
            <button type="button" class="btn-close btn-close-white" onclick="document.getElementById('scanFeedbackToast').style.display='none'"></button>
        </div>

        <div class="row g-4">
            <!-- Universal Scanner Column -->
            <div class="col-lg-6">
                <div class="data-panel h-100 mb-0">
                    <div class="data-panel-header">
                        <h6><i class="fas fa-qrcode me-2 text-primary"></i>Universal QR Code Scanner</h6>
                        <span id="scannerStatusBadge" class="badge-modern badge-purple">
                            <i class="fas fa-circle-notch fa-spin me-1" style="display: none;" id="statusSpin"></i>
                            <span id="statusBadgeText">Ready</span>
                        </span>
                    </div>

                    <div class="p-4">
                        <!-- Mode Switcher Tabs -->
                        <div class="scanner-mode-switch mb-3">
                            <button type="button" id="tabCamera" class="btn-mode-tab flex-grow-1 active" onclick="switchScannerMode('camera')">
                                <i class="fas fa-camera"></i> Live Camera
                            </button>
                            <button type="button" id="tabUpload" class="btn-mode-tab flex-grow-1" onclick="switchScannerMode('upload')">
                                <i class="fas fa-file-arrow-up"></i> Upload QR Image
                            </button>
                        </div>

                        <!-- 1. Live Camera Section -->
                        <div id="cameraModeSection">
                            <!-- Camera selector (if multiple cameras available) -->
                            <div id="cameraSelectGroup" class="mb-3" style="display: none;">
                                <label class="form-label-modern">Video Capture Device</label>
                                <select id="cameraSelect" class="form-select form-select-modern" onchange="onCameraDeviceChange(this.value)">
                                    <option value="">Default Camera</option>
                                </select>
                            </div>

                            <div class="scanner-viewport">
                                <!-- Reticle corner frames -->
                                <div class="reticle-corner reticle-tl" id="reticleTl"></div>
                                <div class="reticle-corner reticle-tr" id="reticleTr"></div>
                                <div class="reticle-corner reticle-bl" id="reticleBl"></div>
                                <div class="reticle-corner reticle-br" id="reticleBr"></div>
                                <div class="scan-laser" id="scanLaser"></div>

                                <!-- Camera reader viewport -->
                                <div id="camera-reader"></div>

                                <!-- Standby Placeholder -->
                                <div class="text-center p-4" id="cameraPlaceholder">
                                    <div class="mb-3">
                                        <i class="fas fa-camera fa-4x text-muted opacity-50"></i>
                                    </div>
                                    <h6 class="cell-strong text-white mb-1">Optical Camera Ready</h6>
                                    <p class="cell-muted small mb-0" style="max-width: 320px;">
                                        Click "Activate Camera" to enable optical video capture and automatically scan barcode or shelf QR labels.
                                    </p>
                                </div>
                            </div>

                            <div class="mt-3 d-flex gap-2 justify-content-center">
                                <button type="button" id="startCamBtn" class="btn-modern btn-primary-dark" onclick="startCamera()">
                                    <i class="fas fa-video me-1"></i> Activate Camera
                                </button>
                                <button type="button" id="stopCamBtn" class="btn-modern btn-ghost" style="display: none;" onclick="stopCamera()">
                                    <i class="fas fa-stop me-1"></i> Stop Camera
                                </button>
                            </div>
                        </div>

                        <!-- 2. Image File Upload Section -->
                        <div id="uploadModeSection" style="display: none;">
                            <div id="dropZone" class="qr-dropzone">
                                <i class="fas fa-cloud-arrow-up fa-3x mb-3 text-primary opacity-75"></i>
                                <h6 class="cell-strong text-white mb-1">Select or Drag & Drop QR Code Image</h6>
                                <p class="cell-muted small mb-3">Supports PNG, JPG, JPEG, SVG, and WebP labels</p>
                                <button type="button" class="btn-modern btn-indigo-dark" onclick="document.getElementById('qrFileInput').click()">
                                    <i class="fas fa-folder-open me-1"></i> Choose File
                                </button>
                                <input type="file" id="qrFileInput" accept="image/*,.svg" style="display: none;" onchange="handleFileUpload(this.files)">
                            </div>

                            <!-- Upload Preview & Scan Result Box -->
                            <div id="uploadPreviewCard" class="mt-3 p-3 rounded" style="display: none; background: var(--bg-surface); border: 1px solid var(--border-strong);">
                                <div class="d-flex align-items-center justify-content-between mb-2">
                                    <span class="cell-muted small fw-semibold"><i class="fas fa-image me-1"></i>Image Analysis</span>
                                    <button type="button" class="btn btn-sm btn-ghost text-muted py-0 px-1" onclick="resetFileUpload()"><i class="fas fa-times"></i></button>
                                </div>
                                <div class="d-flex align-items-center gap-3">
                                    <img id="uploadImgThumb" src="" alt="QR Preview" class="qr-preview-box">
                                    <div class="flex-grow-1">
                                        <div id="uploadFileName" class="cell-strong text-white small text-truncate" style="max-width: 220px;"></div>
                                        <div id="uploadFileSize" class="cell-muted small font-monospace"></div>
                                        <div id="uploadScanState" class="mt-2"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Hidden container for file scan engine -->
                        <div id="file-scan-sandbox" style="display: none;"></div>
                    </div>
                </div>
            </div>

            <!-- Direct Stock Deduction Form Column -->
            <div class="col-lg-6">
                <div class="data-panel h-100 mb-0">
                    <div class="data-panel-header">
                        <h6><i class="fas fa-cart-shopping me-2 text-primary"></i>Stock Deduction Dispatch</h6>
                        <span class="text-muted small">Auto or Manual Entry</span>
                    </div>
                    <div class="p-4">
                        <!-- Real-Time Product Preview Card -->
                        <div id="productPreviewCard" class="mb-3 p-3 rounded" style="display: none; background: var(--bg-surface); border: 1px solid var(--border-strong);">
                            <div class="d-flex align-items-center justify-content-between mb-2">
                                <span class="badge-modern badge-purple" id="previewCategory"><i class="fas fa-tag me-1"></i>Item</span>
                                <span class="badge-modern badge-gold" id="previewWarehouse"><i class="fas fa-warehouse me-1"></i>Warehouse</span>
                            </div>
                            <div class="cell-strong text-white fs-6 mb-1" id="previewItemName">-</div>
                            <div class="d-flex gap-3 small mt-2 pt-2 border-top border-dark">
                                <span class="cell-muted">SKU: <strong class="text-white font-monospace" id="previewSku">-</strong></span>
                                <span class="cell-muted">In Stock: <strong class="text-success font-monospace" id="previewQty">-</strong></span>
                                <span class="cell-muted">Price: <strong class="text-white font-monospace" id="previewPrice">-</strong></span>
                            </div>
                        </div>

                        <form method="POST" id="qrForm">
                            <div class="mb-3">
                                <label class="form-label-modern">Scanned Code or Product SKU *</label>
                                <div class="input-group">
                                    <input type="text" name="qr_code" id="qr_input" class="form-control form-control-modern font-monospace" required placeholder="Point camera, upload image, or type SKU (e.g. KA-A1, AS-A1)" autofocus oninput="onSkuInput(this.value)">
                                    <button class="btn btn-outline-secondary" type="button" onclick="document.getElementById('qr_input').value=''; hideProductPreview();" title="Clear SKU">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                                <div class="cell-muted small mt-1">Optical scan or file upload fills this field automatically.</div>
                            </div>

                            <div class="row g-3 mb-3">
                                <div class="col-md-5">
                                    <label class="form-label-modern">Quantity to Deduct *</label>
                                    <div class="input-group">
                                        <button class="btn btn-outline-secondary" type="button" onclick="adjustQty(-1)">-</button>
                                        <input type="number" min="1" name="quantity" id="quantityInput" class="form-control form-control-modern text-center" value="1" required>
                                        <button class="btn btn-outline-secondary" type="button" onclick="adjustQty(1)">+</button>
                                    </div>
                                </div>
                                <div class="col-md-7">
                                    <label class="form-label-modern">Sale Note / Destination</label>
                                    <input type="text" name="note" class="form-control form-control-modern" value="Store Walk-in / Counter Sale">
                                </div>
                            </div>

                            <!-- Continuous Scanning / Auto Submit Toggle -->
                            <div class="form-check form-switch mb-4">
                                <input class="form-check-input" type="checkbox" id="autoSubmitCheck">
                                <label class="form-check-label cell-muted small" for="autoSubmitCheck">
                                    Instant Dispatch: automatically submit deduction upon successful QR scan
                                </label>
                            </div>

                            <div class="pt-3 border-top border-dark d-flex justify-content-end">
                                <button type="submit" id="submitDeductBtn" class="btn-modern btn-danger-dark w-100 py-2">
                                    <i class="fas fa-minus-circle me-1"></i> Confirm & Deduct Stock
                                </button>
                            </div>
                        </form>

                        <?php if ($scan_result && isset($scan_result['item'])): ?>
                            <div class="mt-4 p-3 rounded" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25);">
                                <div class="d-flex align-items-center justify-content-between mb-2">
                                    <span class="badge-modern badge-green"><i class="fas fa-check-circle me-1"></i>Transaction Recorded</span>
                                    <span class="cell-muted small font-monospace"><?php echo date('H:i:s'); ?></span>
                                </div>
                                <div class="cell-strong text-white mb-1"><?php echo htmlspecialchars($scan_result['item']['item_name']); ?></div>
                                <div class="d-flex gap-3 small mt-2">
                                    <span class="cell-muted">SKU: <strong class="text-white font-monospace"><?php echo htmlspecialchars($scan_result['item']['item_code']); ?></strong></span>
                                    <span class="cell-muted">Deducted: <strong class="text-danger">-<?php echo (int)($_POST['quantity'] ?? 1); ?></strong></span>
                                    <span class="cell-muted">New Balance: <strong class="text-success font-monospace"><?php echo (int)$scan_result['new_stock']; ?> units</strong></span>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </main>
</div>

<!-- html5-qrcode Local + CDN Fallback -->
<script src="<?php echo htmlspecialchars(app_url('assets/js/html5-qrcode.min.js')); ?>"></script>
<script>
if (typeof Html5Qrcode === 'undefined') {
    document.write('<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"><\/script>');
}
</script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

<script>
// Global Scanner State
let activeMode = 'camera';
let cameraScanner = null;
let fileScanner = null;
let isCameraRunning = false;
let selectedCameraId = null;
let lookupDebounce = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initFileScanner();
    setupDropZone();
    enumerateCameras();
});

// Audio Beep Feedback via Web Audio API
function playScanBeep() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
        console.warn('AudioContext not permitted yet:', e);
    }
}

// Mode Switcher
function switchScannerMode(mode) {
    if (activeMode === mode) return;
    activeMode = mode;

    const tabCam = document.getElementById('tabCamera');
    const tabUp = document.getElementById('tabUpload');
    const camSection = document.getElementById('cameraModeSection');
    const upSection = document.getElementById('uploadModeSection');

    if (mode === 'camera') {
        tabCam.classList.add('active');
        tabUp.classList.remove('active');
        camSection.style.display = 'block';
        upSection.style.display = 'none';
        updateStatusBadge('Ready', 'badge-purple');
    } else {
        tabUp.classList.add('active');
        tabCam.classList.remove('active');
        camSection.style.display = 'none';
        upSection.style.display = 'block';
        // Stop camera if running when switching to file upload
        if (isCameraRunning) {
            stopCamera();
        }
        updateStatusBadge('Drop / Upload QR', 'badge-purple');
    }
}

function updateStatusBadge(text, badgeClass) {
    const badge = document.getElementById('scannerStatusBadge');
    const badgeText = document.getElementById('statusBadgeText');
    const spin = document.getElementById('statusSpin');
    if (!badge || !badgeText) return;

    badge.className = 'badge-modern ' + badgeClass;
    badgeText.textContent = text;
    if (spin) {
        spin.style.display = (badgeClass.includes('spinning') || text.includes('Analyzing')) ? 'inline-block' : 'none';
    }
}

// -------------------------------------------------------------
// 1. Camera Scanner Implementation
// -------------------------------------------------------------
function enumerateCameras() {
    if (typeof Html5Qrcode === 'undefined') return;
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
            const sel = document.getElementById('cameraSelect');
            sel.innerHTML = '';
            devices.forEach((device, idx) => {
                const opt = document.createElement('option');
                opt.value = device.id;
                opt.text = device.label || `Camera ${idx + 1}`;
                sel.appendChild(opt);
            });
            selectedCameraId = devices[0].id;
            if (devices.length > 1) {
                document.getElementById('cameraSelectGroup').style.display = 'block';
            }
        }
    }).catch(err => {
        console.log('Camera enumeration error (normal if permission not granted yet):', err);
    });
}

function onCameraDeviceChange(deviceId) {
    selectedCameraId = deviceId;
    if (isCameraRunning) {
        stopCamera().then(() => startCamera());
    }
}

function startCamera() {
    if (isCameraRunning) return;

    const placeholder = document.getElementById('cameraPlaceholder');
    const startBtn = document.getElementById('startCamBtn');
    const stopBtn = document.getElementById('stopCamBtn');
    const laser = document.getElementById('scanLaser');
    const reticles = [document.getElementById('reticleTl'), document.getElementById('reticleTr'), document.getElementById('reticleBl'), document.getElementById('reticleBr')];

    updateStatusBadge('Starting Camera...', 'badge-gold');

    if (!cameraScanner) {
        cameraScanner = new Html5Qrcode("camera-reader");
    }

    const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    const cameraConfig = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: "environment" };

    cameraScanner.start(
        cameraConfig,
        config,
        (decodedText, decodedResult) => {
            onSuccessfulScan(decodedText, 'camera');
        },
        (errorMessage) => {
            // Frame parse miss, expected during video stream
        }
    ).then(() => {
        isCameraRunning = true;
        if (placeholder) placeholder.style.display = 'none';
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-flex';
        if (laser) laser.style.display = 'block';
        reticles.forEach(r => { if (r) r.style.display = 'block'; });
        updateStatusBadge('Scanning Active', 'badge-green');
    }).catch(err => {
        console.error('Camera start error:', err);
        updateStatusBadge('Camera Unavailable', 'badge-red');
        alert('Could not access camera: ' + (err.message || err) + '\n\nPlease ensure camera permissions are allowed, or use the "Upload QR Image" option.');
    });
}

function stopCamera() {
    return new Promise((resolve) => {
        if (!cameraScanner || !isCameraRunning) {
            resolve();
            return;
        }
        cameraScanner.stop().then(() => {
            isCameraRunning = false;
            const placeholder = document.getElementById('cameraPlaceholder');
            const startBtn = document.getElementById('startCamBtn');
            const stopBtn = document.getElementById('stopCamBtn');
            const laser = document.getElementById('scanLaser');
            const reticles = [document.getElementById('reticleTl'), document.getElementById('reticleTr'), document.getElementById('reticleBl'), document.getElementById('reticleBr')];

            if (placeholder) placeholder.style.display = 'block';
            if (startBtn) startBtn.style.display = 'inline-flex';
            if (stopBtn) stopBtn.style.display = 'none';
            if (laser) laser.style.display = 'none';
            reticles.forEach(r => { if (r) r.style.display = 'none'; });
            updateStatusBadge('Camera Paused', 'badge-purple');
            resolve();
        }).catch(err => {
            console.error('Error stopping camera:', err);
            isCameraRunning = false;
            resolve();
        });
    });
}

// -------------------------------------------------------------
// 2. File Upload Scanner Implementation
// -------------------------------------------------------------
function initFileScanner() {
    if (typeof Html5Qrcode !== 'undefined') {
        fileScanner = new Html5Qrcode("file-scan-sandbox");
    }
}

function setupDropZone() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleFileUpload(files);
        }
    }, false);
}

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Show preview card
    const previewCard = document.getElementById('uploadPreviewCard');
    const thumb = document.getElementById('uploadImgThumb');
    const nameEl = document.getElementById('uploadFileName');
    const sizeEl = document.getElementById('uploadFileSize');
    const stateEl = document.getElementById('uploadScanState');

    nameEl.textContent = file.name;
    sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
    stateEl.innerHTML = '<span class="text-warning small"><i class="fas fa-spinner fa-spin me-1"></i> Decoding QR matrix...</span>';
    previewCard.style.display = 'block';

    updateStatusBadge('Analyzing Image...', 'badge-gold');

    // Create preview thumbnail
    const objectUrl = URL.createObjectURL(file);
    thumb.src = objectUrl;

    if (!fileScanner) {
        initFileScanner();
    }

    try {
        const decodedText = await decodeQrFromFileWithFallback(file);
        stateEl.innerHTML = '<span class="text-success small fw-bold"><i class="fas fa-check-circle me-1"></i> Successfully Decoded!</span>';
        updateStatusBadge('QR Decoded', 'badge-green');
        onSuccessfulScan(decodedText, 'file');
    } catch (err) {
        console.warn('QR file decoding failed:', err);
        stateEl.innerHTML = '<span class="text-danger small"><i class="fas fa-times-circle me-1"></i> No QR code found in this image.</span>';
        updateStatusBadge('No QR Detected', 'badge-red');
    }
}

// Robust multi-pass QR decoder (Standard -> Canvas Rasterization -> SVG Text Fallback)
async function decodeQrFromFileWithFallback(file) {
    // Pass 1: Direct html5QrCode scanFile
    try {
        const res = await fileScanner.scanFile(file, false);
        if (res) return res;
    } catch (e1) {
        console.log('Pass 1 direct scanFile attempt failed, attempting high-contrast canvas rasterization...');
    }

    // Pass 2: Canvas Rasterization (solves SVG rendering & low-res mobile captures)
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    // Normalize to crisp 520x520 canvas
                    canvas.width = 520;
                    canvas.height = 520;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 520, 520);
                    ctx.drawImage(img, 20, 20, 480, 480);

                    canvas.toBlob(async function(blob) {
                        if (!blob) {
                            reject(new Error("Canvas rasterization error"));
                            return;
                        }
                        const rasterFile = new File([blob], "normalized_qr.png", { type: "image/png" });
                        try {
                            const res2 = await fileScanner.scanFile(rasterFile, false);
                            resolve(res2);
                        } catch (e2) {
                            // Pass 3: If it's an SVG file, check for embedded SKU patterns
                            if (file.name.toLowerCase().endsWith('.svg') || file.type.includes('svg')) {
                                try {
                                    const svgText = await file.text();
                                    const match = svgText.match(/HQ-ITEM-[\w-]+/);
                                    if (match) {
                                        resolve(match[0]);
                                        return;
                                    }
                                } catch (e3) {}
                            }
                            reject(new Error("No valid QR code matrix detected"));
                        }
                    }, 'image/png');
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error("Image could not be rendered"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
    });
}

function resetFileUpload() {
    document.getElementById('uploadPreviewCard').style.display = 'none';
    document.getElementById('qrFileInput').value = '';
    updateStatusBadge('Ready', 'badge-purple');
}

// -------------------------------------------------------------
// 3. Central Scan Handling & Deduction Workflow
// -------------------------------------------------------------
function onSuccessfulScan(decodedText, source) {
    playScanBeep();

    // Populate SKU input
    const qrInput = document.getElementById('qr_input');
    qrInput.value = decodedText;

    // Flash green visual feedback on input
    qrInput.style.borderColor = '#10b981';
    qrInput.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.3)';
    setTimeout(() => {
        qrInput.style.borderColor = '';
        qrInput.style.boxShadow = '';
    }, 1200);

    // Show scan banner
    const toast = document.getElementById('scanFeedbackToast');
    const toastText = document.getElementById('toastScannedCode');
    toastText.textContent = decodedText;
    toast.style.display = 'flex';

    // Perform live product lookup
    lookupProduct(decodedText);

    // Check Auto-submit toggle
    const autoSubmit = document.getElementById('autoSubmitCheck').checked;
    if (autoSubmit) {
        // Brief pause to allow the user to see the scanned confirmation before submitting
        setTimeout(() => {
            document.getElementById('qrForm').submit();
        }, 500);
    } else {
        // Focus quantity input for fast confirmation
        document.getElementById('quantityInput').focus();
    }
}

function onSkuInput(value) {
    clearTimeout(lookupDebounce);
    if (!value || value.trim().length < 2) {
        hideProductPreview();
        return;
    }
    lookupDebounce = setTimeout(() => {
        lookupProduct(value.trim());
    }, 400);
}

function lookupProduct(code) {
    if (!code) return;
    fetch(`scan.php?action=lookup&code=${encodeURIComponent(code)}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.item) {
                showProductPreview(data.item);
            } else {
                hideProductPreview();
            }
        })
        .catch(err => {
            console.error('Lookup failed:', err);
        });
}

function showProductPreview(item) {
    const card = document.getElementById('productPreviewCard');
    document.getElementById('previewItemName').textContent = item.item_name;
    document.getElementById('previewCategory').innerHTML = `<i class="fas fa-tag me-1"></i>${item.category || 'General'}`;
    document.getElementById('previewWarehouse').innerHTML = `<i class="fas fa-warehouse me-1"></i>${item.warehouse_name || 'Warehouse'}`;
    document.getElementById('previewSku').textContent = item.item_code;
    document.getElementById('previewQty').textContent = `${item.quantity} units`;
    document.getElementById('previewPrice').textContent = `RM ${parseFloat(item.selling_price || 0).toFixed(2)}`;
    card.style.display = 'block';
}

function hideProductPreview() {
    document.getElementById('productPreviewCard').style.display = 'none';
}

function adjustQty(delta) {
    const qtyInput = document.getElementById('quantityInput');
    let val = parseInt(qtyInput.value) || 1;
    val += delta;
    if (val < 1) val = 1;
    qtyInput.value = val;
}
</script>
</body>
</html>
