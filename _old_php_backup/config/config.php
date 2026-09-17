<?php
/**
 * System Configuration
 */

// Error Reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Timezone
date_default_timezone_set('Asia/Kuala_Lumpur');

// Session Configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', 0); // Set to 1 for HTTPS

// Application Constants
define('APP_NAME', 'HQ Inventory Management System');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'http://localhost/hq-inventory-system');
define('UPLOAD_PATH', __DIR__ . '/../assets/qr-codes/');
define('LOG_PATH', __DIR__ . '/../logs/');

// Security
define('SALT', 'your-secret-salt-here-change-this');
define('JWT_SECRET', 'your-jwt-secret-here-change-this');

// QR Code Settings
define('QR_WIDTH', 300);
define('QR_HEIGHT', 300);
define('QR_IMAGE_FORMAT', 'png');

// Stock Thresholds
define('DEFAULT_CRITICAL', 2);
define('DEFAULT_LOW', 10);
define('DEFAULT_OVERSTOCK', 100);

// API Settings
define('API_RATE_LIMIT', 100); // requests per minute
define('API_TOKEN_EXPIRY', 3600); // 1 hour

// Load Composer dependencies if exists
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
}

// Include database configuration
require_once __DIR__ . '/database.php';