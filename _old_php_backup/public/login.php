<?php
/**
 * Single Unified Login Gateway
 * Modern Minimalist UI & Dynamic Role-Based Redirection
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/sessionManager.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/paths.php';

SessionManager::start();

// Redirect if already logged in using central role map
if (Auth::isLoggedIn()) {
    $user = Auth::getCurrentUser();
    $role = $user['role'] ?? ($_SESSION['user_role'] ?? '');
    header('Location: ' . Auth::getDashboardUrl($role));
    exit;
}

$error = '';
$alertType = 'danger'; // 'danger' or 'warning'
$emailValue = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = trim($_POST['password'] ?? '');
    $emailValue = $email;

    if ($email === '' || $password === '') {
        $error = 'Please enter both email/username and password.';
        $alertType = 'danger';
    } else {
        $pdo = Database::getInstance()->getConnection();
        $auth = new Auth($pdo);
        $result = $auth->login($email, $password);

        if ($result['success']) {
            header('Location: ' . $result['redirect']);
            exit;
        } else {
            $error = $result['message'];
            if (($result['code'] ?? '') === 'pending_approval') {
                $alertType = 'warning';
            } else {
                $alertType = 'danger';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign In — HQ Inventory Management System</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg:            #f8fafc;
            --surface:       #ffffff;
            --border:        #e2e8f0;
            --text:          #0f172a;
            --text-muted:    #64748b;
            --accent:        #4f46e5;
            --accent-hover:  #4338ca;
            --success:       #10b981;
            --warning:       #f59e0b;
            --danger:        #ef4444;
            --radius-card:   16px;
            --radius-btn:    10px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        .login-wrapper {
            width: 100%;
            max-width: 420px;
        }

        .brand-header {
            text-align: center;
            margin-bottom: 28px;
        }

        .brand-logo-badge {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            background: linear-gradient(135deg, var(--accent) 0%, #3730a3 100%);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 16px;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.25);
        }

        .brand-title {
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.02em;
            margin-bottom: 6px;
        }

        .brand-subtitle {
            font-size: 14px;
            color: var(--text-muted);
            font-weight: 400;
        }

        .login-card {
            background-color: var(--surface);
            border-radius: var(--radius-card);
            padding: 32px;
            box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.02);
            border: 1px solid var(--border);
        }

        .alert-box {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            border-radius: 10px;
            font-size: 13.5px;
            margin-bottom: 24px;
            line-height: 1.45;
        }

        .alert-danger {
            background-color: rgba(239, 68, 68, 0.09);
            color: #991b1b;
            border-left: 4px solid var(--danger);
        }

        .alert-warning {
            background-color: rgba(245, 158, 11, 0.10);
            color: #92400e;
            border-left: 4px solid var(--warning);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 7px;
        }

        .form-input {
            width: 100%;
            min-height: 44px;
            padding: 10px 14px;
            font-size: 14px;
            font-family: inherit;
            color: var(--text);
            background-color: #ffffff;
            border: 1px solid var(--border);
            border-radius: var(--radius-btn);
            transition: border-color 150ms ease, box-shadow 150ms ease;
            outline: none;
        }

        .form-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .form-input::placeholder {
            color: #94a3b8;
        }

        .btn-submit {
            width: 100%;
            min-height: 44px;
            padding: 10px 18px;
            background-color: var(--accent);
            color: #ffffff;
            border: none;
            border-radius: var(--radius-btn);
            font-size: 14.5px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: background-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
            margin-top: 8px;
        }

        .btn-submit:hover:not(:disabled) {
            background-color: var(--accent-hover);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
        }

        .btn-submit:active:not(:disabled) {
            transform: translateY(0);
        }

        .btn-submit:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .spinner {
            display: none;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #ffffff;
            animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .card-footer-links {
            margin-top: 24px;
            text-align: center;
            font-size: 13.5px;
            color: var(--text-muted);
        }

        .card-footer-links a {
            color: var(--accent);
            text-decoration: none;
            font-weight: 600;
            transition: color 150ms ease;
        }

        .card-footer-links a:hover {
            color: var(--accent-hover);
            text-decoration: underline;
        }

        .system-meta {
            text-align: center;
            margin-top: 24px;
            font-size: 12px;
            color: #94a3b8;
        }

        @media (max-width: 480px) {
            .login-card {
                padding: 24px 20px;
            }
        }
    </style>
</head>
<body>

<div class="login-wrapper">
    <header class="brand-header">
        <div class="brand-logo-badge">HQ</div>
        <h1 class="brand-title">Inventory Command</h1>
        <p class="brand-subtitle">Unified warehouse portal &amp; inventory control</p>
    </header>

    <div class="login-card">
        <?php if (!empty($error)): ?>
            <div class="alert-box alert-<?php echo $alertType; ?>" role="alert" aria-live="polite">
                <span><?php echo $alertType === 'warning' ? '⏳' : '⚠️'; ?></span>
                <div><?php echo htmlspecialchars($error); ?></div>
            </div>
        <?php endif; ?>

        <form method="POST" action="<?php echo htmlspecialchars(app_url('login.php')); ?>" id="loginForm" novalidate>
            <div class="form-group">
                <label for="emailInput" class="form-label">Email or Username</label>
                <input 
                    type="text" 
                    id="emailInput" 
                    name="email" 
                    class="form-input" 
                    placeholder="name@example.com" 
                    value="<?php echo htmlspecialchars($emailValue); ?>"
                    required 
                    autocomplete="username"
                    autofocus
                >
            </div>

            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
                    <label for="passwordInput" class="form-label" style="margin-bottom: 0;">Password</label>
                </div>
                <input 
                    type="password" 
                    id="passwordInput" 
                    name="password" 
                    class="form-input" 
                    placeholder="••••••••" 
                    required 
                    autocomplete="current-password"
                >
            </div>

            <button type="submit" class="btn-submit" id="submitBtn">
                <span class="spinner" id="btnSpinner"></span>
                <span id="btnText">Sign In to Dashboard</span>
            </button>
        </form>

        <div class="card-footer-links">
            Don't have an account? 
            <a href="<?php echo htmlspecialchars(app_url('register.php')); ?>">Request access</a>
        </div>
    </div>

    <footer class="system-meta">
        &copy; <?php echo date('Y'); ?> HQ Multi-Role Inventory Management System
    </footer>
</div>

<script>
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        const email = document.getElementById('emailInput').value.trim();
        const pass = document.getElementById('passwordInput').value;
        if (!email || !pass) return;

        const btn = document.getElementById('submitBtn');
        const spinner = document.getElementById('btnSpinner');
        const btnText = document.getElementById('btnText');

        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = 'Authenticating...';
    });
</script>

</body>
</html>
