<?php
/**
 * User Registration Gateway
 * Role Selection, Warehouse Binding & Super Admin Approval Request
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/sessionManager.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/paths.php';

SessionManager::start();

// Redirect if already logged in
if (Auth::isLoggedIn()) {
    $user = Auth::getCurrentUser();
    $role = $user['role'] ?? ($_SESSION['user_role'] ?? '');
    header('Location: ' . Auth::getDashboardUrl($role));
    exit;
}

// Available roles for public self-registration (Super Admin is strictly excluded)
$roles = [
    'admin_kaftanasia' => [
        'title' => 'Admin Kaftanasia',
        'warehouse_id' => 1,
        'warehouse_name' => 'Kaftan Asia Exclusive',
        'desc' => 'Manages apparel, fabrics, clothing sizes, and boutique inventory.',
        'icon' => '👗',
        'badge' => 'Warehouse 1'
    ],
    'admin_astech' => [
        'title' => 'Admin Astech',
        'warehouse_id' => 2,
        'warehouse_name' => 'Astech Kedai PC',
        'desc' => 'Manages PC systems, hardware components, and tech accessories.',
        'icon' => '💻',
        'badge' => 'Warehouse 2'
    ]
];

$error = '';
$isRegistered = false;
$registeredEmail = '';

$formData = [
    'full_name' => '',
    'email' => '',
    'role' => 'admin_kaftanasia' // Default pre-selection
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $full_name = trim($_POST['full_name'] ?? '');
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';
    $password_confirmation = $_POST['password_confirmation'] ?? '';
    $role = $_POST['role'] ?? '';

    $formData['full_name'] = $full_name;
    $formData['email'] = $email;
    $formData['role'] = $role;

    if ($full_name === '' || $email === '' || $password === '' || $role === '') {
        $error = 'All fields are required. Please complete the form.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Please enter a valid email address.';
    } elseif (!isset($roles[$role])) {
        $error = 'Invalid warehouse role selected.';
    } elseif (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters long.';
    } elseif ($password !== $password_confirmation) {
        $error = 'Password confirmation does not match.';
    } else {
        try {
            $pdo = Database::getInstance()->getConnection();

            // Check if email already exists
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                throw new RuntimeException('An account with this email address already exists.');
            }

            // Derive assigned warehouse ID
            $assignedWarehouseId = $roles[$role]['warehouse_id'];

            // Synthesize username from email
            $username = explode('@', $email)[0];

            // Insert new user with is_active = 0 (Pending Approval)
            $insertQuery = 'INSERT INTO users (email, username, password_hash, full_name, role, assigned_warehouse_id, is_active, created_at) '
                         . 'VALUES (?, ?, ?, ?, ?, ?, 0, NOW())';
            $stmt = $pdo->prepare($insertQuery);
            $stmt->execute([
                $email,
                $username,
                password_hash($password, PASSWORD_DEFAULT),
                $full_name,
                $role,
                $assignedWarehouseId
            ]);

            $newUserId = (int)$pdo->lastInsertId();

            // Record registration event in audit log
            try {
                $audit = $pdo->prepare("
                    INSERT INTO audit_logs (user_id, action, ip_address, user_agent, new_values) 
                    VALUES (?, 'registration_request', ?, ?, ?)
                ");
                $audit->execute([
                    $newUserId,
                    $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                    $_SERVER['HTTP_USER_AGENT'] ?? 'Web Browser',
                    json_encode([
                        'email' => $email,
                        'role' => $role,
                        'warehouse_id' => $assignedWarehouseId,
                        'status' => 'pending_approval'
                    ])
                ]);
            } catch (Throwable $auditErr) {}

            $isRegistered = true;
            $registeredEmail = $email;

        } catch (Throwable $e) {
            $error = $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request Account — HQ Inventory Management System</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg:            #f8fafc;
            --surface:       #ffffff;
            --border:        #e2e8f0;
            --border-focus:  #cbd5e1;
            --text:          #0f172a;
            --text-muted:    #64748b;
            --accent:        #4f46e5;
            --accent-hover:  #4338ca;
            --accent-soft:   rgba(79, 70, 229, 0.06);
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
            padding: 32px 16px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        .register-wrapper {
            width: 100%;
            max-width: 560px;
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
            font-size: 24px;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.02em;
            margin-bottom: 6px;
        }

        .brand-subtitle {
            font-size: 14px;
            color: var(--text-muted);
        }

        .register-card {
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
            background-color: rgba(239, 68, 68, 0.09);
            color: #991b1b;
            border-left: 4px solid var(--danger);
        }

        /* ── Role Picker Component ── */
        .role-picker-section {
            margin-bottom: 24px;
        }

        .section-label {
            font-size: 13px;
            font-weight: 700;
            color: var(--text);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .role-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }

        .role-card {
            border: 2px solid var(--border);
            border-radius: 14px;
            padding: 16px 14px;
            cursor: pointer;
            transition: all 150ms ease;
            position: relative;
            background-color: #ffffff;
            user-select: none;
        }

        .role-card:hover {
            border-color: #cbd5e1;
            transform: translateY(-1px);
        }

        .role-card input[type="radio"] {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }

        .role-card.selected {
            border-color: var(--accent);
            background-color: var(--accent-soft);
            box-shadow: 0 0 0 1px var(--accent);
        }

        .role-card-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .role-icon {
            font-size: 20px;
            line-height: 1;
        }

        .role-name {
            font-size: 14.5px;
            font-weight: 700;
            color: var(--text);
        }

        .role-chip {
            display: inline-block;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 6px;
            background-color: #e0e7ff;
            color: #3730a3;
            margin-bottom: 6px;
        }

        .role-desc {
            font-size: 12px;
            color: var(--text-muted);
            line-height: 1.4;
        }

        /* ── Form Inputs ── */
        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .form-group {
            margin-bottom: 18px;
        }

        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 6px;
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

        .form-input.is-invalid {
            border-color: var(--danger);
            background-color: #fef2f2;
        }

        .input-hint {
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 5px;
        }

        .field-feedback {
            font-size: 12px;
            color: var(--danger);
            margin-top: 4px;
            display: none;
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
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            margin-top: 10px;
        }

        .btn-submit:hover:not(:disabled) {
            background-color: var(--accent-hover);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
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
        }

        .card-footer-links a:hover {
            text-decoration: underline;
        }

        /* ── Success State Replacement Card ── */
        .success-panel {
            text-align: center;
            padding: 20px 10px;
        }

        .success-icon-badge {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background-color: #dcfce7;
            color: #16a34a;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            margin-bottom: 20px;
        }

        .success-title {
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 10px;
        }

        .success-message {
            font-size: 14.5px;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 28px;
        }

        .success-meta-box {
            background-color: #f8fafc;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: left;
            font-size: 13px;
        }

        .btn-outline {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            padding: 10px 24px;
            background-color: transparent;
            color: var(--accent);
            border: 1px solid var(--accent);
            border-radius: var(--radius-btn);
            font-size: 14.5px;
            font-weight: 600;
            text-decoration: none;
            transition: all 150ms ease;
        }

        .btn-outline:hover {
            background-color: var(--accent-soft);
        }

        @media (max-width: 640px) {
            .role-grid {
                grid-template-columns: 1fr;
            }
            .form-grid {
                grid-template-columns: 1fr;
            }
            .register-card {
                padding: 24px 20px;
            }
        }
    </style>
</head>
<body>

<div class="register-wrapper">
    <header class="brand-header">
        <div class="brand-logo-badge">HQ</div>
        <h1 class="brand-title">Create Warehouse Account</h1>
        <p class="brand-subtitle">Submit access request for assigned warehouse facility</p>
    </header>

    <div class="register-card">
        <?php if ($isRegistered): ?>
            <!-- ── Registration Success State ── -->
            <div class="success-panel" role="region" aria-live="polite">
                <div class="success-icon-badge">✓</div>
                <h2 class="success-title">Registration Received</h2>
                <p class="success-message">
                    Your registration for <strong><?php echo htmlspecialchars($registeredEmail); ?></strong> was successfully recorded.
                    For warehouse security compliance, new administrator accounts require manual Super Admin verification before access is granted.
                </p>

                <div class="success-meta-box">
                    <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">Status: ⏳ Pending Super Admin Approval</div>
                    <div style="color: #64748b;">An administrator will review your assigned role and activate your account. You will be able to log in once approved.</div>
                </div>

                <a href="<?php echo htmlspecialchars(app_url('login.php')); ?>" class="btn-outline">
                    &larr; Back to Sign In
                </a>
            </div>
        <?php else: ?>
            <!-- ── Registration Form ── -->
            <?php if (!empty($error)): ?>
                <div class="alert-box" role="alert" aria-live="polite">
                    <span>⚠️</span>
                    <div><?php echo htmlspecialchars($error); ?></div>
                </div>
            <?php endif; ?>

            <form method="POST" action="<?php echo htmlspecialchars(app_url('register.php')); ?>" id="regForm" novalidate>
                <!-- Role Picker -->
                <div class="role-picker-section">
                    <div class="section-label">
                        <span>Select Assigned Role</span>
                        <span style="font-size: 11px; text-transform: none; color: var(--text-muted); font-weight: 500;">Warehouse is auto-assigned</span>
                    </div>

                    <div class="role-grid">
                        <?php foreach ($roles as $rKey => $rMeta): ?>
                            <?php $isSelected = ($formData['role'] === $rKey); ?>
                            <label class="role-card <?php echo $isSelected ? 'selected' : ''; ?>" id="role-card-<?php echo $rKey; ?>">
                                <input 
                                    type="radio" 
                                    name="role" 
                                    value="<?php echo htmlspecialchars($rKey); ?>" 
                                    <?php echo $isSelected ? 'checked' : ''; ?>
                                    onchange="selectRoleCard('<?php echo $rKey; ?>')"
                                >
                                <div class="role-card-header">
                                    <span class="role-icon"><?php echo $rMeta['icon']; ?></span>
                                    <span class="role-name"><?php echo htmlspecialchars($rMeta['title']); ?></span>
                                </div>
                                <span class="role-chip"><?php echo htmlspecialchars($rMeta['warehouse_name']); ?></span>
                                <p class="role-desc"><?php echo htmlspecialchars($rMeta['desc']); ?></p>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="form-group">
                    <label for="fullNameInput" class="form-label">Full Name</label>
                    <input 
                        type="text" 
                        id="fullNameInput" 
                        name="full_name" 
                        class="form-input" 
                        placeholder="e.g. Ahmad Razak" 
                        value="<?php echo htmlspecialchars($formData['full_name']); ?>" 
                        required
                    >
                    <div class="field-feedback" id="nameFeedback">Please enter your full name.</div>
                </div>

                <div class="form-group">
                    <label for="emailInput" class="form-label">Email Address</label>
                    <input 
                        type="email" 
                        id="emailInput" 
                        name="email" 
                        class="form-input" 
                        placeholder="name@warehouse.hq" 
                        value="<?php echo htmlspecialchars($formData['email']); ?>" 
                        required
                    >
                    <div class="field-feedback" id="emailFeedback">Please enter a valid email address.</div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label for="passwordInput" class="form-label">Password</label>
                        <input 
                            type="password" 
                            id="passwordInput" 
                            name="password" 
                            class="form-input" 
                            placeholder="Min. 8 characters" 
                            required
                        >
                        <div class="field-feedback" id="passwordFeedback">Password must be at least 8 characters.</div>
                    </div>

                    <div class="form-group">
                        <label for="passwordConfirmInput" class="form-label">Confirm Password</label>
                        <input 
                            type="password" 
                            id="passwordConfirmInput" 
                            name="password_confirmation" 
                            class="form-input" 
                            placeholder="Re-enter password" 
                            required
                        >
                        <div class="field-feedback" id="confirmFeedback">Passwords must match.</div>
                    </div>
                </div>

                <button type="submit" class="btn-submit" id="submitBtn">
                    <span class="spinner" id="btnSpinner"></span>
                    <span id="btnText">Submit Registration Request</span>
                </button>
            </form>

            <div class="card-footer-links">
                Already approved? 
                <a href="<?php echo htmlspecialchars(app_url('login.php')); ?>">Sign in here</a>
            </div>
        <?php endif; ?>
    </div>
</div>

<script>
    function selectRoleCard(roleKey) {
        document.querySelectorAll('.role-card').forEach(card => card.classList.remove('selected'));
        const activeCard = document.getElementById('role-card-' + roleKey);
        if (activeCard) activeCard.classList.add('selected');
    }

    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.addEventListener('submit', function(e) {
            let isValid = true;

            const nameInput = document.getElementById('fullNameInput');
            const emailInput = document.getElementById('emailInput');
            const passInput = document.getElementById('passwordInput');
            const confirmInput = document.getElementById('passwordConfirmInput');

            const nameFeedback = document.getElementById('nameFeedback');
            const emailFeedback = document.getElementById('emailFeedback');
            const passFeedback = document.getElementById('passwordFeedback');
            const confirmFeedback = document.getElementById('confirmFeedback');

            // Reset feedbacks
            [nameInput, emailInput, passInput, confirmInput].forEach(inp => inp.classList.remove('is-invalid'));
            [nameFeedback, emailFeedback, passFeedback, confirmFeedback].forEach(fb => fb.style.display = 'none');

            if (!nameInput.value.trim()) {
                nameInput.classList.add('is-invalid');
                nameFeedback.style.display = 'block';
                isValid = false;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
                emailInput.classList.add('is-invalid');
                emailFeedback.style.display = 'block';
                isValid = false;
            }

            if (passInput.value.length < 8) {
                passInput.classList.add('is-invalid');
                passFeedback.style.display = 'block';
                isValid = false;
            }

            if (passInput.value !== confirmInput.value) {
                confirmInput.classList.add('is-invalid');
                confirmFeedback.style.display = 'block';
                isValid = false;
            }

            if (!isValid) {
                e.preventDefault();
                return;
            }

            const btn = document.getElementById('submitBtn');
            const spinner = document.getElementById('btnSpinner');
            const btnText = document.getElementById('btnText');

            btn.disabled = true;
            spinner.style.display = 'inline-block';
            btnText.textContent = 'Submitting Request...';
        });
    }
</script>

</body>
</html>
