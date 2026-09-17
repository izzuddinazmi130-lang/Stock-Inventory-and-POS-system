<?php
// public/dashboard/admin_kaftanasia.php - Kaftanasia Boutique Inventory
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();

// Strict Role Check - Allow admin_kaftanasia and super_admin
if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], ['admin_kaftanasia', 'super_admin'])) {
    header('Location: ' . app_url('login.php'));
    exit;
}

$user = SessionManager::getUser();
$currentUserRole = $user['role'];
$currentUserName = $user['full_name'] ?? $user['name'] ?? 'Admin Kaftan';
$currentUserEmail = $user['email'] ?? 'kaftanasia@admin.com';
?>
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KAFTANASIA — Sistem Inventory</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>
        :root {
            --bg:       #f5ede1;
            --card:     rgba(255, 252, 247, 0.93);
            --line:     rgba(160, 118, 72, 0.22);
            --text:     #2b1d0e;
            --muted:    #7d6448;
            --primary:  #8b5e2a;
            --gold:     #b8851e;
            --maroon:   #6b2020;
            --green:    #1a6b3a;
            --amber:    #92520a;
            --shadow:   0 4px 24px rgba(120, 80, 30, 0.10);
        }

        * { box-sizing: border-box; }

        /* ── diamond lattice background ── */
        body {
            margin: 0;
            font-family: 'Rajdhani', sans-serif;
            font-size: 15px;
            color: var(--text);
            min-height: 100vh;
            background-color: var(--bg);
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M24 2L46 24L24 46L2 24Z' fill='none' stroke='rgba(160,118,72,0.18)' stroke-width='1'/%3E%3Ccircle cx='24' cy='24' r='2.2' fill='rgba(160,118,72,0.10)'/%3E%3Ccircle cx='0' cy='0' r='2.2' fill='rgba(160,118,72,0.10)'/%3E%3Ccircle cx='48' cy='0' r='2.2' fill='rgba(160,118,72,0.10)'/%3E%3Ccircle cx='0' cy='48' r='2.2' fill='rgba(160,118,72,0.10)'/%3E%3Ccircle cx='48' cy='48' r='2.2' fill='rgba(160,118,72,0.10)'/%3E%3C/svg%3E");
        }

        /* ── layout ── */
        body { display: flex; min-height: 100vh; }

        /* ════════════════════════════════════
           SIDEBAR
        ════════════════════════════════════ */
        .sidebar {
            width: 240px;
            flex-shrink: 0;
            background: linear-gradient(180deg, #1e1208 0%, #2b1d0e 30%, #3c2410 70%, #4a2d12 100%);
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; left: 0; bottom: 0;
            z-index: 100;
            overflow-y: auto;
            overflow-x: hidden;
        }

        /* diamond lattice overlay on sidebar */
        .sidebar::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M24 2L46 24L24 46L2 24Z' fill='none' stroke='rgba(255,210,100,0.07)' stroke-width='1'/%3E%3C/svg%3E");
            pointer-events: none;
        }

        /* ── sidebar brand ── */
        .sb-brand {
            padding: 28px 16px 22px;
            text-align: center;
            border-bottom: 1px solid rgba(210,175,80,0.12);
            position: relative;
            flex-shrink: 0;
            background: linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 100%);
        }
        .sb-logo {
            width: 96px;
            height: 96px;
            object-fit: contain;
            filter: drop-shadow(0 4px 16px rgba(255,210,80,0.45));
            display: block;
            margin: 0 auto 12px;
            transition: transform 0.3s ease;
        }
        .sb-logo:hover { transform: scale(1.05); }
        .sb-brand h2 {
            margin: 0;
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            background: linear-gradient(135deg, #f5e0b0 20%, #ffd060 55%, #f5e0b0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.2;
        }
        .sb-brand .sb-excl {
            display: inline-block;
            font-family: 'Cormorant Garamond', serif;
            font-style: italic;
            font-size: 10px;
            letter-spacing: 0.36em;
            color: rgba(255,210,120,0.50);
            text-transform: uppercase;
            margin-top: 4px;
            border-top: 1px solid rgba(210,175,80,0.18);
            border-bottom: 1px solid rgba(210,175,80,0.18);
            padding: 2px 8px;
        }
        .sb-store {
            margin-top: 10px;
            font-size: 11px;
            color: rgba(210,175,120,0.45);
            letter-spacing: 0.08em;
            background: rgba(255,255,255,0.04);
            border-radius: 999px;
            padding: 3px 10px;
            display: inline-block;
        }

        /* ── sidebar nav ── */
        .sb-nav {
            flex: 1;
            padding: 8px 12px;
            position: relative;
        }

        .sb-section-label {
            padding: 16px 6px 6px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.20em;
            color: rgba(210,175,100,0.30);
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .sb-section-label::after {
            content: '';
            flex: 1;
            height: 1px;
            background: rgba(210,175,80,0.12);
        }

        .sb-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            margin-bottom: 2px;
            cursor: pointer;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
            color: rgba(240, 210, 160, 0.55);
            font-family: 'Rajdhani', sans-serif;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.02em;
            transition: all 0.18s ease;
            border-radius: 12px;
            position: relative;
        }
        .sb-item:hover {
            background: rgba(210,175,80,0.10);
            color: rgba(255,230,170,0.95);
            transform: translateX(2px);
        }
        .sb-item.active {
            background: linear-gradient(135deg, rgba(210,175,80,0.22), rgba(184,133,30,0.15));
            color: #ffd060;
            font-weight: 700;
            box-shadow: 0 2px 12px rgba(184,133,30,0.18), inset 0 0 0 1px rgba(210,175,80,0.20);
        }
        .sb-item.active .sb-icon { transform: scale(1.15); }
        .sb-item .sb-icon {
            font-size: 17px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: rgba(255,255,255,0.04);
            flex-shrink: 0;
            transition: transform 0.18s;
        }

        /* ── sidebar footer ── */
        .sb-footer {
            padding: 14px 12px;
            border-top: 1px solid rgba(210,175,80,0.12);
            flex-shrink: 0;
            position: relative;
        }
        .sb-avatar-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            padding: 8px 10px;
            background: rgba(255,255,255,0.04);
            border-radius: 12px;
            border: 1px solid rgba(210,175,80,0.10);
        }
        .sb-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: linear-gradient(135deg, #b8851e, #7a4f10);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            flex-shrink: 0;
            border: 1.5px solid rgba(210,175,80,0.30);
        }
        .sb-user {
            font-size: 12px;
            color: rgba(210,175,120,0.70);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        .sb-logout {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            width: 100%;
            text-align: center;
            padding: 9px 12px;
            border: 1px solid rgba(200,80,80,0.25);
            border-radius: 12px;
            background: rgba(180,60,60,0.08);
            color: rgba(255,170,150,0.70);
            font-family: 'Rajdhani', sans-serif;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.18s;
            letter-spacing: 0.04em;
        }
        .sb-logout:hover { background: rgba(180,60,60,0.18); color: #ffb0a0; border-color: rgba(200,80,80,0.45); }

        /* ════════════════════════════════════
           MAIN AREA
        ════════════════════════════════════ */
        .main-area {
            flex: 1;
            margin-left: 240px;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }

        /* ── thin topbar ── */
        .topbar {
            height: 64px;
            background: #fff;
            border-bottom: 1px solid var(--line);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 26px;
            gap: 12px;
            position: sticky;
            top: 0;
            z-index: 50;
            box-shadow: 0 1px 14px rgba(120,80,30,0.07);
        }
        .topbar-left { display: flex; flex-direction: column; justify-content: center; }
        .topbar-title {
            font-family: 'Playfair Display', serif;
            font-size: 17px;
            color: var(--primary);
            font-weight: 700;
            letter-spacing: 0.03em;
            line-height: 1.2;
        }
        .topbar-date { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; margin-top: 1px; }

        /* ── page content ── */
        .page-content { flex: 1; padding: 22px 24px 36px; }

        /* ── tab panels ── */
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }

        /* ── wrap for inner max-width ── */
        .inner { max-width: 1140px; }

        .chip {
            border: 1px solid rgba(184,133,30,0.25);
            background: rgba(184,133,30,0.08);
            color: var(--primary);
            border-radius: 999px;
            padding: 5px 14px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
        }

        .btn {
            border: 1px solid transparent;
            border-radius: 12px;
            padding: 8px 18px;
            font: inherit;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.18s ease;
            letter-spacing: 0.03em;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.10); }
        .btn:active { transform: translateY(0); box-shadow: none; }

        .btn-main {
            background: linear-gradient(135deg, #c99320, #a07018);
            color: #fff;
            box-shadow: 0 2px 10px rgba(184,133,30,0.30);
        }
        .btn-ghost {
            border-color: var(--line);
            background: transparent;
            color: var(--primary);
        }
        .btn-ghost:hover { background: rgba(139,94,42,0.07); }
        .btn-success {
            background: linear-gradient(135deg, #1d7a45, #155f35);
            color: #fff;
            box-shadow: 0 2px 10px rgba(30,120,60,0.25);
        }
        .btn-danger {
            background: linear-gradient(135deg, #a03030, #7a2020);
            color: #fff;
        }

        /* inner buttons (table rows, modals — on light bg) */
        .btn-inner-ghost {
            border: 1px solid rgba(160,118,72,0.22);
            background: #fff;
            color: var(--primary);
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            border-radius: 10px;
            padding: 5px 12px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .btn-inner-ghost:hover { background: rgba(139,94,42,0.06); border-color: rgba(139,94,42,0.35); }

        .btn-inner-green {
            border: 1px solid rgba(26,107,58,0.22);
            background: rgba(26,107,58,0.06);
            color: var(--green);
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            border-radius: 10px;
            padding: 5px 12px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .btn-inner-green:hover { background: rgba(26,107,58,0.13); border-color: rgba(26,107,58,0.40); }

        .btn-inner-red {
            border: 1px solid rgba(107,32,32,0.20);
            background: rgba(107,32,32,0.05);
            color: var(--maroon);
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            border-radius: 10px;
            padding: 5px 12px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .btn-inner-red:hover { background: rgba(107,32,32,0.11); border-color: rgba(107,32,32,0.35); }

        /* ── flash ── */
        .flash {
            margin-bottom: 16px;
            border: 1px solid transparent;
            border-radius: 14px;
            padding: 12px 16px;
            display: none;
            font-weight: 600;
            font-size: 14px;
            gap: 8px;
        }
        .flash.show { display: flex; align-items: center; }
        .flash.success { background: #f0faf5; border-color: rgba(26,107,58,0.22); color: #1a6b3a; }
        .flash.error   { background: #fdf2f2; border-color: rgba(160,40,40,0.22); color: #8b2020; }

        /* ── stats ── */
        .stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 22px;
        }

        .stat {
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 20px;
            padding: 18px 16px 16px;
            box-shadow: 0 2px 12px rgba(120,80,30,0.06);
            position: relative;
            overflow: hidden;
            transition: transform 0.18s, box-shadow 0.18s;
        }
        .stat:hover { transform: translateY(-2px); box-shadow: 0 6px 22px rgba(120,80,30,0.11); }
        .stat::before {
            content: '';
            position: absolute;
            top: 0; left: 0; bottom: 0;
            width: 4px;
            background: linear-gradient(180deg, var(--gold), rgba(184,133,30,0.20));
            border-radius: 20px 0 0 20px;
        }
        .stat.stat-low::before { background: linear-gradient(180deg, var(--amber), rgba(146,82,10,0.20)); }
        .stat.stat-out::before { background: linear-gradient(180deg, var(--maroon), rgba(107,32,32,0.20)); }
        .stat .icon {
            font-size: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            background: rgba(184,133,30,0.07);
            border: 1px solid rgba(184,133,30,0.12);
            border-radius: 12px;
            margin-bottom: 10px;
        }
        .stat.stat-low .icon { background: rgba(146,82,10,0.07); border-color: rgba(146,82,10,0.14); }
        .stat.stat-out .icon { background: rgba(107,32,32,0.07); border-color: rgba(107,32,32,0.14); }
        .stat .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.10em; font-weight: 700; }
        .stat .value {
            margin-top: 3px;
            font-family: 'Playfair Display', serif;
            font-size: 36px;
            font-weight: 700;
            color: var(--primary);
            line-height: 1;
        }
        .stat.stat-low .value { color: var(--amber); }
        .stat.stat-out .value { color: var(--maroon); }

        /* ── panel ── */
        .panel {
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 20px;
            padding: 22px 24px;
            margin-bottom: 18px;
            box-shadow: 0 2px 12px rgba(120,80,30,0.06);
        }

        .panel h2 {
            margin: 0;
            font-family: 'Playfair Display', serif;
            font-size: 17px;
            color: var(--primary);
            letter-spacing: 0.02em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .panel h2::before {
            content: '';
            display: inline-block;
            width: 4px;
            height: 18px;
            background: linear-gradient(180deg, var(--gold), rgba(184,133,30,0.25));
            border-radius: 4px;
            flex-shrink: 0;
        }

        .panel-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: center;
            margin-bottom: 14px;
            flex-wrap: wrap;
        }

        .toolbar { display: flex; gap: 8px; flex-wrap: wrap; }

        /* ── divider ── */
        .divider {
            border: none;
            border-top: 1px solid var(--line);
            margin: 12px 0;
        }

        /* ── filters ── */
        .filters {
            display: grid;
            grid-template-columns: 1.2fr 1fr 1fr;
            gap: 10px;
            margin-bottom: 14px;
        }

        .sortable-th {
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }

        .sortable-th:hover {
            color: var(--primary);
        }

        .input,
        .select {
            width: 100%;
            border: 1.5px solid var(--line);
            border-radius: 12px;
            padding: 10px 14px;
            font: inherit;
            font-size: 14px;
            color: var(--text);
            background: #fffcf7;
            transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .input:focus, .select:focus {
            outline: none;
            border-color: var(--gold);
            box-shadow: 0 0 0 3px rgba(184,133,30,0.09);
            background: #fff;
        }

        /* ── table ── */
        .table-wrap {
            border: 1px solid var(--line);
            border-radius: 12px;
            overflow: auto;
        }

        table { width: 100%; border-collapse: collapse; min-width: 940px; }
        thead { background: #fdf8f0; }
        th {
            padding: 11px 14px;
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.09em;
            font-weight: 700;
            border-bottom: 1.5px solid var(--line);
            text-align: left;
        }
        td {
            padding: 11px 14px;
            border-bottom: 1px solid rgba(160,118,72,0.08);
            font-size: 14px;
            vertical-align: middle;
        }
        .item-thumb {
            width: 52px;
            height: 52px;
            border-radius: 10px;
            object-fit: cover;
            border: 1px solid rgba(160,118,72,0.25);
            background: #fff;
            display: block;
            cursor: zoom-in;
            transition: transform 0.12s ease;
        }
        .item-thumb:hover {
            transform: scale(1.06);
        }

        .image-hover-preview {
            position: fixed;
            width: 230px;
            height: 230px;
            border-radius: 14px;
            border: 1px solid rgba(160,118,72,0.35);
            box-shadow: 0 16px 34px rgba(30, 15, 5, 0.28);
            background: #fff;
            overflow: hidden;
            pointer-events: none;
            z-index: 3000;
            display: none;
        }

        .image-hover-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .item-thumb-placeholder {
            width: 52px;
            height: 52px;
            border-radius: 10px;
            border: 1px dashed rgba(160,118,72,0.35);
            color: var(--muted);
            font-size: 10px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            line-height: 1.2;
        }
        tr:last-child td { border-bottom: none; }
        tbody tr { transition: background 0.12s; }
        tbody tr:hover { background: #fffbf4; }

        /* ── status pills ── */
        .status-pill {
            display: inline-block;
            border-radius: 999px;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.04em;
        }
        .pill-ok  { background: rgba(26,107,58,0.12);  color: #1a6b3a; border: 1px solid rgba(26,107,58,0.25); }
        .pill-low { background: rgba(146,82,10,0.12);  color: #92520a; border: 1px solid rgba(146,82,10,0.30); }
        .pill-out { background: rgba(107,32,32,0.12);  color: #6b2020; border: 1px solid rgba(107,32,32,0.25); }

        .row-actions { display: flex; gap: 6px; flex-wrap: wrap; }

        .qr-shell {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 16px;
        }

        .qr-card {
            border: 1px solid var(--line);
            border-radius: 18px;
            background: rgba(255, 252, 247, 0.84);
            padding: 18px;
        }

        .qr-card h3 {
            margin: 0 0 8px;
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            color: var(--primary);
        }

        .qr-lead {
            margin: 0 0 14px;
            color: var(--muted);
            font-size: 13px;
            line-height: 1.7;
        }

        .qr-mode-row,
        .qr-toolbar,
        .qr-input-row,
        .qr-cart-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
        }

        .qr-mode-btn {
            border: 1px solid var(--line);
            background: #fff;
            color: var(--primary);
            border-radius: 999px;
            padding: 8px 14px;
            font: inherit;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
        }

        .qr-mode-btn.active.stock-in {
            background: rgba(26,107,58,0.12);
            color: var(--green);
            border-color: rgba(26,107,58,0.25);
        }

        .qr-mode-btn.active.stock-out {
            background: rgba(107,32,32,0.12);
            color: var(--maroon);
            border-color: rgba(107,32,32,0.25);
        }

        .qr-camera-box {
            margin-top: 14px;
            border: 1px dashed rgba(160,118,72,0.35);
            border-radius: 16px;
            background: #fff;
            padding: 14px;
        }

        .qr-video {
            width: 100%;
            max-height: 280px;
            border-radius: 14px;
            background: #efe5d7;
            display: none;
            object-fit: cover;
        }

        .qr-video.active { display: block; }

        .qr-camera-empty {
            border-radius: 14px;
            padding: 28px 16px;
            text-align: center;
            color: var(--muted);
            background: #fff8ee;
        }

        .qr-summary {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
            color: var(--muted);
            font-size: 13px;
            flex-wrap: wrap;
        }

        .qr-cart-list {
            display: grid;
            gap: 10px;
            margin-bottom: 12px;
        }

        .qr-cart-item {
            border: 1px solid rgba(160,118,72,0.16);
            border-radius: 16px;
            background: #fff;
            padding: 12px;
            display: grid;
            grid-template-columns: 56px 1fr auto;
            gap: 12px;
            align-items: center;
        }

        .qr-cart-title {
            margin: 0 0 4px;
            font-weight: 700;
            color: var(--text);
        }

        .qr-cart-meta {
            font-size: 12px;
            color: var(--muted);
            line-height: 1.6;
        }

        .qr-qty-box {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .qr-qty-input {
            width: 82px;
            text-align: center;
        }

        .qr-note {
            margin-top: 12px;
        }

        .qr-status-line {
            margin-top: 8px;
            min-height: 18px;
            color: var(--muted);
            font-size: 12px;
        }

        /* ── empty state ── */
        .empty {
            padding: 44px 20px;
            text-align: center;
            color: var(--muted);
        }
        .empty-icon { font-size: 38px; margin-bottom: 10px; }
        .empty-text { font-size: 14px; font-style: italic; }

        /* ── modal overlay ── */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(30, 15, 5, 0.60);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999;
            padding: 24px;
        }
        .modal-overlay.hidden { display: none; }

        .modal-box {
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 24px;
            width: 100%;
            max-width: 540px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 28px;
            position: relative;
            box-shadow: 0 24px 72px rgba(80,40,10,0.16);
        }

        .modal-deco {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--gold), var(--primary), var(--gold));
            border-radius: 20px 20px 0 0;
        }

        .modal-title {
            margin: 4px 0 16px;
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            color: var(--primary);
        }

        .image-upload-box {
            border: 1px dashed rgba(184,133,30,0.45);
            border-radius: 16px;
            background: #fffaf2;
            padding: 14px;
        }

        .image-upload-row {
            display: flex;
            gap: 14px;
            align-items: center;
            flex-wrap: wrap;
        }

        .image-upload-preview {
            width: 92px;
            height: 92px;
            border-radius: 16px;
            border: 1px solid rgba(160,118,72,0.20);
            background: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            color: var(--muted);
            font-size: 12px;
            text-align: center;
            flex: 0 0 auto;
        }

        .image-upload-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .image-upload-actions {
            display: grid;
            gap: 8px;
            flex: 1 1 240px;
        }

        .image-upload-note {
            font-size: 12px;
            color: var(--muted);
        }

        .upload-status {
            min-height: 18px;
            font-size: 12px;
            color: var(--muted);
        }

        .qr-item-box {
            max-width: 420px;
            text-align: center;
        }

        .qr-item-title {
            margin: 4px 0 8px;
            font-family: 'Playfair Display', serif;
            color: var(--primary);
            font-size: 22px;
        }

        .qr-item-subtitle {
            margin: 0 0 8px;
            color: var(--muted);
            font-size: 13px;
        }

        .qr-item-code {
            font-family: 'Rajdhani', sans-serif;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.08em;
            color: var(--text);
            margin: 2px 0 14px;
        }

        .qr-code-holder {
            width: 230px;
            height: 230px;
            margin: 0 auto 12px;
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 10px;
        }

        .qr-code-holder img,
        .qr-code-holder canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
        }

        .qr-help-text {
            margin: 0;
            font-size: 12px;
            color: var(--muted);
            line-height: 1.6;
        }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .field { margin-bottom: 10px; }
        .field label {
            display: block;
            margin-bottom: 6px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.09em;
            color: var(--muted);
            font-weight: 700;
        }

        .modal-actions {
            margin-top: 16px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .modal-actions .btn { border-radius: 10px; }
        .modal-actions .btn-main { background: linear-gradient(135deg, var(--gold), #c4991f); color: #fff; }
        .modal-actions .btn-ghost { border-color: var(--line); background: transparent; color: var(--muted); }
        .modal-actions .btn-success { background: linear-gradient(135deg, #1d7a45, #15603a); color: #fff; }

        /* ── detail modal ── */
        .detail-modal-box {
            max-width: 880px;
        }
        .detail-hero {
            display: grid;
            grid-template-columns: 160px 1fr;
            gap: 18px;
            align-items: start;
            margin-bottom: 16px;
        }
        .detail-image {
            width: 160px;
            height: 160px;
            border-radius: 20px;
            border: 1px solid var(--line);
            background: #fffcf7;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            color: var(--muted);
            font-size: 12px;
            text-align: center;
            font-weight: 700;
        }
        .detail-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .detail-name {
            font-size: 16px;
            font-weight: 700;
            color: var(--text);
            margin: 0 0 8px;
        }
        .detail-description {
            margin: 0;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.65;
        }
        .detail-chip-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 10px;
        }
        .detail-chip {
            border: 1px solid var(--line);
            background: rgba(184,133,30,0.06);
            color: var(--primary);
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 700;
        }
        .detail-sections {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }
        .detail-card {
            border: 1px solid var(--line);
            border-radius: 18px;
            background: #fffcf7;
            padding: 14px;
        }
        .detail-card h4 {
            margin: 0 0 12px;
            font-family: 'Playfair Display', serif;
            font-size: 14px;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 0.02em;
        }
        .detail-list {
            display: grid;
            gap: 8px;
        }
        .detail-row {
            display: grid;
            grid-template-columns: 0.6fr 1fr;
            gap: 8px;
            font-size: 13px;
        }
        .detail-label {
            color: var(--muted);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-size: 11px;
        }
        .detail-value {
            color: var(--text);
            font-weight: 600;
            word-break: break-word;
        }

        /* ── scrollbar ── */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(160,118,72,0.30); border-radius: 99px; }

        /* ── responsive ── */
        @media (max-width: 900px) {
            .sidebar { width: 200px; }
            .main-area { margin-left: 200px; }
        }
        /* ── analytics ── */
        .analytics-bar-wrap { display: grid; gap: 10px; }
        .analytics-bar-row { display: grid; grid-template-columns: 130px 1fr 80px; gap: 8px; align-items: center; font-size: 13px; }
        .analytics-bar-label { color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .analytics-bar-track { height: 10px; background: rgba(184,133,30,0.10); border-radius: 999px; overflow: hidden; }
        .analytics-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold), var(--primary)); transition: width 0.4s ease; }
        .analytics-bar-fill.green { background: linear-gradient(90deg, #1d7a45, #1a9456); }
        .analytics-bar-fill.red { background: linear-gradient(90deg, #a03030, #c03838); }
        .analytics-bar-val { text-align: right; color: var(--muted); font-size: 12px; font-weight: 700; }
        .analytics-move-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .analytics-move-card { border: 1px solid var(--line); border-radius: 14px; padding: 14px 12px; text-align: center; background: #fffcf7; }
        .analytics-move-card .move-icon { font-size: 22px; margin-bottom: 6px; }
        .analytics-move-card .move-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted); font-weight: 700; }
        .analytics-move-card .move-val { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: var(--primary); line-height: 1.1; margin: 4px 0 2px; }
        .analytics-move-card .move-sub { font-size: 12px; color: var(--muted); }
        .analytics-rd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .analytics-rd-card { border-radius: 16px; padding: 18px 16px; text-align: center; }
        .analytics-rd-card.return-card { background: rgba(26,107,58,0.07); border: 1px solid rgba(26,107,58,0.18); }
        .analytics-rd-card.damage-card { background: rgba(107,32,32,0.07); border: 1px solid rgba(107,32,32,0.18); }
        .analytics-rd-icon { font-size: 28px; margin-bottom: 8px; }
        .analytics-rd-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em; font-weight: 700; margin-bottom: 6px; }
        .analytics-rd-card.return-card .analytics-rd-label { color: var(--green); }
        .analytics-rd-card.damage-card .analytics-rd-label { color: var(--maroon); }
        .analytics-rd-val { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; line-height: 1; }
        .analytics-rd-card.return-card .analytics-rd-val { color: var(--green); }
        .analytics-rd-card.damage-card .analytics-rd-val { color: var(--maroon); }
        .analytics-rd-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
        .top-item-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(160,118,72,0.08); }
        .top-item-row:last-child { border-bottom: none; }
        .top-item-rank { width: 24px; height: 24px; border-radius: 50%; background: rgba(184,133,30,0.12); color: var(--primary); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .top-item-info { flex: 1; min-width: 0; }
        .top-item-code { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .top-item-meta { font-size: 11px; color: var(--muted); }
        .top-item-qty { font-size: 14px; font-weight: 700; color: var(--primary); white-space: nowrap; }

        @media (max-width: 900px) {
            .analytics-grid-2 { grid-template-columns: 1fr !important; }
            .analytics-move-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 680px) {
            body { flex-direction: column; }
            .sidebar { position: relative; width: 100%; height: auto; flex-direction: row; flex-wrap: wrap; }
            .sidebar::before { display: none; }
            .sb-brand { padding: 12px 16px; border-bottom: none; display: flex; align-items: center; gap: 10px; text-align: left; }
            .sb-logo { width: 40px; height: 40px; margin: 0; }
            .sb-nav { display: flex; flex-direction: row; overflow-x: auto; padding: 0; width: 100%; border-top: 1px solid rgba(210,175,80,0.15); }
            .sb-section-label { display: none; }
            .sb-item { white-space: nowrap; border-left: none; border-bottom: 3px solid transparent; padding: 9px 14px; font-size: 12px; }
            .sb-item.active { border-left-color: transparent; border-bottom-color: var(--gold); }
            .sb-footer { width: 100%; display: flex; gap: 8px; align-items: center; padding: 8px 16px; }
            .sb-user { margin-bottom: 0; }
            .main-area { margin-left: 0; }
            .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .filters { grid-template-columns: 1fr; }
            .form-grid { grid-template-columns: 1fr; }
            .qr-shell { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>

    <!-- ══════════  SIDEBAR  ══════════ -->
    <link rel="icon" type="image/png" href="https://res.cloudinary.com/dd9grczp5/image/upload/v1770430109/images_1_xlb8fg.png">
    <aside class="sidebar">
        <div class="sb-brand">
            <img src="<?php echo htmlspecialchars(app_url("assets/kaftanasia_logo.png")); ?>" alt="Kaftan Asia Logo" class="sb-logo">
            <h2>Kaftan Asia</h2>
            <span class="sb-excl">Exclusive</span>
            <div class="sb-store" id="sbStoreName">—</div>
        </div>

        <nav class="sb-nav">
            <div class="sb-section-label">Menu Utama</div>
            <button class="sb-item" data-panel="dashboard" onclick="switchPanel('dashboard')">
                <span class="sb-icon">📊</span> Dashboard
            </button>
            <button class="sb-item active" data-panel="inventory" onclick="switchPanel('inventory')">
                <span class="sb-icon">📦</span> Inventory Items
            </button>
            <button class="sb-item" data-panel="history" onclick="switchPanel('history')">
                <span class="sb-icon">📋</span> Stock History
            </button>
            <button class="sb-item" data-panel="qr" onclick="switchPanel('qr')">
                <span class="sb-icon">📱</span> Stock QR
            </button>

            <div class="sb-section-label">Pengurusan</div>
            <button class="sb-item" data-panel="returns" onclick="switchPanel('returns')">
                <span class="sb-icon">⚠️</span> Returns &amp; Damage
            </button>
            <button class="sb-item" data-panel="analytics" onclick="switchPanel('analytics')">
                <span class="sb-icon">📈</span> Analytics
            </button>

            <div class="sb-section-label">Lain-lain</div>
            <button class="sb-item" data-panel="settings" onclick="switchPanel('settings')">
                <span class="sb-icon">⚙️</span> Settings
            </button>
        </nav>

        <div class="sb-footer">
            <div class="sb-avatar-row">
                <div class="sb-avatar" id="sbAvatar">K</div>
                <div class="sb-user" id="sbUser">Stock Manager Kaftan</div>
            </div>
            <a class="sb-logout" href="<?php echo htmlspecialchars(app_url("logout.php")); ?>">⏻&nbsp; Log Keluar</a>
        </div>
    </aside>

    <!-- ══════════  MAIN AREA  ══════════ -->
    <main class="main-area">

        <!-- thin top bar -->
        <header class="topbar">
            <div class="topbar-left">
                <div class="topbar-title" id="topbarTitle">Inventory Items</div>
                <div class="topbar-date" id="topbarDate"></div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="chip" id="userChip">Stock Manager Kaftan</span>
                <button class="btn btn-ghost" type="button" id="refreshBtn" style="font-size:12px;padding:6px 12px;">↺ Refresh</button>
                <button class="btn btn-main" type="button" id="addItemBtn" style="font-size:12px;padding:6px 12px;">+ Tambah Item</button>
            </div>
        </header>

        <div class="page-content">
            <div id="flash" class="flash"></div>

            <!-- ── PANEL: Dashboard ── -->
            <div class="tab-panel" id="panel-dashboard">
                 <section class="stats">
                    <article class="stat">
                        <span class="icon">📦</span>
                        <div class="label">Jumlah Item</div>
                        <div class="value" id="sTotalItems">0</div>
                    </article>
                    <article class="stat">
                        <span class="icon">🗂️</span>
                        <div class="label">Jumlah Unit Stok</div>
                        <div class="value" id="sTotalUnits">0</div>
                    </article>
                    <article class="stat stat-low">
                        <span class="icon">⚠️</span>
                        <div class="label">Item Stok Rendah</div>
                        <div class="value" id="sLowStock">0</div>
                    </article>
                    <article class="stat stat-out">
                        <span class="icon">🚫</span>
                        <div class="label">Kehabisan Stok</div>
                        <div class="value" id="sOutStock">0</div>
                    </article>
                </section>
                <section class="panel">
                    <div class="panel-head">
                            <h2>Ringkasan</h2>
                    </div>
                    <hr class="divider">
                        <p style="color:var(--muted);font-size:14px;margin:0;line-height:1.7;">
                            Selamat datang ke <strong style="color:var(--primary);">Sistem Inventori Kaftan Asia</strong>. 🌸<br>
                            Gunakan menu di kiri untuk navigasi. Klik <strong>Inventory Items</strong> untuk lihat dan urus senarai stok.
                        </p>
                </section>
            </div>

            <!-- ── PANEL: Inventory Items ── -->
            <div class="tab-panel active" id="panel-inventory">
                <section class="panel">
                    <div class="panel-head">
                        <h2>Senarai Inventory</h2>
                        <div class="toolbar">
                            <button class="btn-inner-green" type="button" id="newItemBtn">+ New Item</button>
                            <button class="btn-inner-ghost" type="button" id="manageCategoryBtn">Urus Kategori</button>
                            <button class="btn-inner-ghost" type="button" id="exportBtn">⬇ Export CSV</button>
                        </div>
                    </div>
                    <hr class="divider">
                    <div class="filters">
                        <input class="input" id="searchInput" type="text" placeholder="🔍  Cari ID item / nama item...">
                        <select class="select" id="typeFilter">
                            <option value="">Semua Type</option>
                        </select>
                        <select class="select" id="categoryFilter">
                            <option value="">Semua Kategori</option>
                        </select>
                        <select class="select" id="stockFilter">
                            <option value="">Semua Status Stok</option>
                            <option value="low">Stok Rendah</option>
                            <option value="out">Kehabisan Stok</option>
                        </select>
                    </div>
                    <div class="table-wrap" id="tableWrap">
                        <div class="empty">Memuatkan inventory...</div>
                    </div>
                </section>
            </div>

            <!-- ── PANEL: Stock History ── -->
            <div class="tab-panel" id="panel-history">
                <section class="panel">
                    <div class="panel-head"><h2>Stock History</h2></div>
                    <hr class="divider">
                        <p style="color:var(--muted);font-size:13px;line-height:1.7;margin:0 0 14px;">Sejarah ini merekod semua pergerakan stok seperti stock in, stock out dan adjust lengkap dengan maklumat item, warna, size dan harga.</p>
                        <div class="table-wrap" id="historyWrap">
                            <div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Memuatkan sejarah pergerakan stok...</div></div>
                        </div>
                </section>
            </div>

            <!-- ── PANEL: Stock QR ── -->
            <div class="tab-panel" id="panel-qr">
                <section class="panel">
                    <div class="panel-head"><h2>Stock QR</h2></div>
                    <hr class="divider">
                    <div class="qr-shell">
                        <div class="qr-card">
                            <h3>Stock In/Out With QR</h3>
                            <p class="qr-lead">Scan item ke dalam cart, ubah kuantiti jika perlu, kemudian submit. Boleh guna 2D barcode scanner atau kamera jika browser menyokong.</p>
                            <div class="qr-mode-row" id="qrModeRow">
                                <button class="qr-mode-btn stock-in active" type="button" data-qr-mode="in">⬇ Stock In (+)</button>
                                <button class="qr-mode-btn stock-out" type="button" data-qr-mode="out">⬆ Stock Out (-)</button>
                            </div>
                            <div class="field" style="margin-top:14px;">
                                <label for="qrScanInput">Barcode/QR Input</label>
                                <div class="qr-input-row">
                                    <input class="input" id="qrScanInput" type="text" placeholder="Scan di sini (scanner hardware atau manual)">
                                    <button class="btn btn-ghost" type="button" id="qrAddBtn">Tambah</button>
                                    <button class="btn btn-ghost" type="button" id="qrClearInputBtn">Clear Input</button>
                                </div>
                            </div>
                            <div class="qr-camera-box">
                                <div class="qr-toolbar">
                                    <button class="btn btn-ghost" type="button" id="startCameraBtn">Start Camera</button>
                                    <button class="btn btn-ghost" type="button" id="stopCameraBtn">Stop Camera</button>
                                    <button class="btn btn-ghost" type="button" id="refreshCameraBtn">Refresh Camera</button>
                                </div>
                                <div class="qr-status-line" id="qrCameraStatus">Camera optional. Guna scanner hardware lebih stabil untuk operasi kaunter.</div>
                                <video id="qrVideo" class="qr-video" autoplay muted playsinline></video>
                                <div class="qr-camera-empty" id="qrCameraEmpty">Camera belum dimulakan.</div>
                            </div>
                        </div>
                        <div class="qr-card">
                            <h3>Cart</h3>
                            <div class="qr-summary">
                                <span id="qrCartCount">0 items</span>
                                <span id="qrCartModeText">Mode: Stock In</span>
                            </div>
                            <div class="qr-cart-list" id="qrCartList">
                                <div class="empty"><div class="empty-icon">🧺</div><div class="empty-text">Cart kosong. Scan item untuk tambah.</div></div>
                            </div>
                            <div class="field qr-note">
                                <label for="qrCartNote">Nota</label>
                                <input class="input" id="qrCartNote" type="text" placeholder="Contoh: Terima stok dari pembekal / jualan kedai depan">
                            </div>
                            <div class="qr-cart-actions">
                                <button class="btn btn-ghost" type="button" id="qrClearCartBtn">🗑 Clear Cart</button>
                                <button class="btn btn-main" type="button" id="qrSubmitBtn">✓ Update Stock</button>
                            </div>
                            <div class="qr-status-line" id="qrCartStatus"></div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- ── PANEL: Returns & Damage ── -->
            <div class="tab-panel" id="panel-returns">
                <section class="panel">
                    <div class="panel-head"><h2>Returns &amp; Damage</h2></div>
                    <hr class="divider">
                    <div class="form-grid" style="margin-bottom: 10px;">
                        <div class="field">
                            <label for="rdItemSelect">Item</label>
                            <select id="rdItemSelect" class="select">
                                <option value="">Pilih item</option>
                            </select>
                        </div>
                        <div class="field">
                            <label for="rdType">Jenis Rekod</label>
                            <select id="rdType" class="select">
                                <option value="return">Return (Tambah Stok)</option>
                                <option value="damage">Damage (Tolak Stok)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-grid" style="margin-bottom: 10px;">
                        <div class="field">
                            <label for="rdQty">Kuantiti</label>
                            <input id="rdQty" class="input" type="number" min="0.01" step="0.01" placeholder="Contoh: 2">
                        </div>
                        <div class="field">
                            <label for="rdNote">Nota</label>
                            <input id="rdNote" class="input" type="text" placeholder="Contoh: Return dari pelanggan / Kain koyak masa QC">
                        </div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
                        <button class="btn btn-main" type="button" id="rdSaveBtn">Simpan Return/Damage</button>
                    </div>
                    <div class="table-wrap" id="rdWrap">
                        <div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Belum ada rekod return/damage.</div></div>
                    </div>
                </section>
            </div>

            <!-- ── PANEL: Analytics ── -->
            <div class="tab-panel" id="panel-analytics">

                <!-- KPI row -->
                <section class="stats" id="analyticsKpi" style="margin-bottom:18px;">
                    <article class="stat">
                        <span class="icon">💰</span>
                        <div class="label">Nilai Kos Stok</div>
                        <div class="value" id="aKpiCost" style="font-size:22px;">—</div>
                    </article>
                    <article class="stat">
                        <span class="icon">🏷️</span>
                        <div class="label">Nilai Jual Stok</div>
                        <div class="value" id="aKpiSell" style="font-size:22px;">—</div>
                    </article>
                    <article class="stat">
                        <span class="icon">📊</span>
                        <div class="label">Potensi Untung</div>
                        <div class="value" id="aKpiProfit" style="font-size:22px;">—</div>
                    </article>
                    <article class="stat stat-low">
                        <span class="icon">📦</span>
                        <div class="label">Stok Rendah / Habis</div>
                        <div class="value" id="aKpiAlert" style="font-size:22px;">—</div>
                    </article>
                </section>

                <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:18px;margin-bottom:18px;" class="analytics-grid-2">

                    <!-- Category breakdown -->
                    <section class="panel" style="margin-bottom:0;">
                        <div class="panel-head"><h2>Breakdown Kategori</h2></div>
                        <hr class="divider">
                        <div id="aCatWrap">
                            <div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>
                        </div>
                    </section>

                    <!-- Top 5 items -->
                    <section class="panel" style="margin-bottom:0;">
                        <div class="panel-head"><h2>Top 5 Item Tertinggi Stok</h2></div>
                        <hr class="divider">
                        <div id="aTopWrap">
                            <div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>
                        </div>
                    </section>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;" class="analytics-grid-2">

                    <!-- Movement summary -->
                    <section class="panel" style="margin-bottom:0;">
                        <div class="panel-head"><h2>Pergerakan Stok (30 Hari)</h2></div>
                        <hr class="divider">
                        <div id="aMoveWrap">
                            <div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>
                        </div>
                    </section>

                    <!-- Returns & Damage summary -->
                    <section class="panel" style="margin-bottom:0;">
                        <div class="panel-head"><h2>Ringkasan Return &amp; Damage</h2></div>
                        <hr class="divider">
                        <div id="aRdWrap">
                            <div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>
                        </div>
                    </section>
                </div>

                <!-- Top Stock In / Stock Out row -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px;" class="analytics-grid-2">

                    <!-- Top 5 Stock In -->
                    <section class="panel" style="margin-bottom:0;">
                        <div class="panel-head"><h2>🟢 Top 5 Tertinggi Stock In</h2></div>
                        <hr class="divider">
                        <div id="aTopInWrap">
                            <div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>
                        </div>
                    </section>

                    <!-- Top 5 Stock Out -->
                    <section class="panel" style="margin-bottom:0;">
                        <div class="panel-head"><h2>🔴 Top 5 Tertinggi Stock Out</h2></div>
                        <hr class="divider">
                        <div id="aTopOutWrap">
                            <div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>
                        </div>
                    </section>
                </div>

            </div>

            <!-- ── PANEL: Settings ── -->
            <div class="tab-panel" id="panel-settings">
                <section class="panel">
                    <div class="panel-head"><h2>Settings</h2></div>
                    <hr class="divider">
                        <div class="empty"><div class="empty-icon">⚙️</div><div class="empty-text">Tetapan sistem akan datang tidak lama lagi.</div></div>
                </section>
            </div>

        </div><!-- /page-content -->
    </main><!-- /main-area -->

        <div class="image-hover-preview" id="imageHoverPreview">
            <img id="imageHoverPreviewImg" src="" alt="Preview gambar">
        </div>

    <!-- ── QR Item modal ── -->
    <div class="modal-overlay hidden" id="qrItemModal">
        <div class="modal-box qr-item-box">
            <div class="modal-deco"></div>
            <h3 class="qr-item-title">QR Item Baharu</h3>
            <p class="qr-item-subtitle" id="qrItemNameText">-</p>
            <div class="qr-item-code" id="qrItemCodeText">-</div>
            <div class="qr-code-holder" id="qrCodeHolder"></div>
            <p class="qr-help-text">Scan kod ini menggunakan scanner untuk terus isi ID item ke sistem.</p>
            <div class="modal-actions" style="justify-content:center;">
                <button class="btn btn-ghost" type="button" id="qrModalCloseBtn">Tutup</button>
                <button class="btn btn-ghost" type="button" id="qrDownloadBtn">⬇ Download QR</button>
                <button class="btn btn-main" type="button" id="qrPrintBtn">🖨 Print Label</button>
            </div>
        </div>
    </div>

    <!-- ── Add / Edit Item modal ── -->
    <div class="modal-overlay hidden" id="itemModal">
        <div class="modal-box">
            <div class="modal-deco"></div>
            <h3 class="modal-title" id="itemModalTitle">Tambah Item</h3>
            <div class="field" id="iSkuField" style="display:none;"><label for="iSku">ID Item</label><input id="iSku" class="input" type="text" placeholder="Auto: KA-K1 / KA-A1"></div>
            <div class="form-grid">
                <div class="field"><label for="iType">Type (Jenis Baju)</label><input id="iType" class="input" type="text" placeholder="Contoh: Kaftan / Abaya"></div>
                <div class="field"><label for="iSize">Size</label><input id="iSize" class="input" type="text" placeholder="Contoh: S / M / L / XL"></div>
            </div>
            <div class="form-grid">
                <div class="field"><label for="iCategory">Category </label><input id="iCategory" class="input" type="text" placeholder="Contoh: Safira" list="categorySuggestionList"></div>
                <datalist id="categorySuggestionList"></datalist>
                <div class="field"><label for="iVariantColor">Variant (Warna)</label><input id="iVariantColor" class="input" type="text" placeholder="Contoh: Hitam"></div>
            </div>
            <div class="form-grid">
                <div class="field"><label for="iName">Nama Item (Auto jika kosong)</label><input id="iName" class="input" type="text" placeholder="Contoh: Kaftan Safira Hitam"></div>
                <div class="field"><label for="iUnit">Unit</label><input id="iUnit" class="input" type="text" placeholder="pcs"></div>
            </div>
            <div class="field">
                <label for="iImageFile">Gambar Item</label>
                <div class="image-upload-box">
                    <div class="image-upload-row">
                        <div class="image-upload-preview" id="iImagePreview">No Image</div>
                        <div class="image-upload-actions">
                            <input id="iImageFile" class="input" type="file" accept="image/*">
                            <div class="upload-status" id="iImageStatus">Pilih gambar untuk upload.</div>
                            <button class="btn btn-ghost" type="button" id="clearImageBtn">Buang Gambar</button>
                            <div class="image-upload-note">Format dibenarkan: JPG, PNG, GIF, WEBP. Maksimum 5MB.</div>
                        </div>
                    </div>
                </div>
                <input id="iImageUrl" type="hidden">
            </div>
            <div class="form-grid">
                <div class="field"><label for="iQty">Kuantiti Awal</label><input id="iQty" class="input" type="number" step="0.01" min="0" value="0"></div>
                <div class="field"><label for="iMinQty">Minimum Qty</label><input id="iMinQty" class="input" type="number" step="0.01" min="0" value="0"></div>
            </div>
            <div class="form-grid">
                <div class="field"><label for="iUnitPrice">Unit Price (RM)</label><input id="iUnitPrice" class="input" type="number" step="0.01" min="0" value="0"></div>
                <div class="field"><label for="iSellingPrice">Selling Price (RM)</label><input id="iSellingPrice" class="input" type="number" step="0.01" min="0" value="0"></div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" type="button" id="itemDeleteBtn" style="margin-right:auto;display:none;">Padam Item</button>
                <button class="btn btn-ghost" type="button" id="itemCancelBtn">Tutup</button>
                <button class="btn btn-main" type="button" id="itemSaveBtn">Simpan</button>
            </div>
        </div>
    </div>

    <!-- ── Stock In/Out modal ── -->
    <div class="modal-overlay hidden" id="stockModal">
        <div class="modal-box">
            <div class="modal-deco"></div>
            <h3 class="modal-title" id="stockModalTitle">Kemaskini Stok</h3>
            <div class="field"><label for="mType">Jenis Pergerakan</label>
                <select id="mType" class="select">
                    <option value="in">Stock In (Tambah)</option>
                    <option value="out">Stock Out (Tolak)</option>
                    <option value="adjust">Adjust Exact Qty</option>
                </select>
            </div>
            <div class="field"><label for="mQty">Kuantiti</label><input id="mQty" class="input" type="number" step="1" min="1"></div>
            <div class="field"><label for="mNote">Nota (optional)</label><input id="mNote" class="input" type="text" placeholder="Contoh: Terima dari pembekal"></div>
            <div class="modal-actions">
                <button class="btn btn-ghost" type="button" id="stockCancelBtn">Tutup</button>
                <button class="btn btn-success" type="button" id="stockSaveBtn">Simpan Pergerakan</button>
            </div>
        </div>
    </div>

    <!-- ── Detail Modal ── -->
    <div class="modal-overlay hidden" id="detailModal">
        <div class="modal-box detail-modal-box">
            <div class="modal-deco"></div>
            <h3 class="modal-title">Detail Item</h3>
            <div class="detail-hero">
                <div class="detail-image" id="detailImage">No Image</div>
                <div>
                    <div class="detail-chip-row" id="detailChipRow"></div>
                    <div class="detail-name" id="detailName">-</div>
                    <p class="detail-description" id="detailDescription">-</p>
                </div>
            </div>
            <div class="detail-sections">
                <section class="detail-card">
                    <h4>Maklumat Umum</h4>
                    <div class="detail-list" id="detailGeneralList"></div>
                </section>
                <section class="detail-card">
                    <h4>Maklumat Tambahan</h4>
                    <div class="detail-list" id="detailSpecList"></div>
                </section>
            </div>
            <div class="modal-actions">
                <button class="btn btn-ghost" type="button" id="detailCloseBtn">Tutup</button>
            </div>
        </div>
    </div>

        <script>
        const WAREHOUSE_ID = 1;
        const API_URL = '<?php echo app_url("api/stock_inventory.php"); ?>';
        const UPLOAD_API_URL = '<?php echo app_url("api/upload_stock_image.php"); ?>';
        const LOGOUT_URL = '<?php echo app_url("logout.php"); ?>';

        let inventory = { store: null, stats: {}, items: [], categories: [] };
        let editingItemId = 0;
        let activeMoveItemId = 0;
        let activeDetailItemId = 0;
        let currentPanel = 'inventory';
        let isUploadingImage = false;
        let qrMode = 'in';
        let qrCart = [];
        let qrCameraStream = null;
        let qrScannerTimer = null;
        let tableSortBy = 'id_item';
        let tableSortDir = 'asc';
        let currentQrItem = null;

        const flash = document.getElementById('flash');
        const tableWrap = document.getElementById('tableWrap');
        const searchInput = document.getElementById('searchInput');
        const typeFilter = document.getElementById('typeFilter');
        const categoryFilter = document.getElementById('categoryFilter');
        const categorySuggestionList = document.getElementById('categorySuggestionList');
        const stockFilter = document.getElementById('stockFilter');
        const imageHoverPreview = document.getElementById('imageHoverPreview');
        const imageHoverPreviewImg = document.getElementById('imageHoverPreviewImg');

        function getQrDataUrl() {
            const holder = document.getElementById('qrCodeHolder');
            if (!holder) return '';
            const canvas = holder.querySelector('canvas');
            if (canvas) return canvas.toDataURL('image/png');
            const img = holder.querySelector('img');
            return img ? img.src : '';
        }

        function openQrItemModal(itemId) {
            const item = (inventory.items || []).find((x) => Number(x.id) === Number(itemId));
            if (!item) {
                showFlash('Item tidak ditemui untuk jana QR.', 'error');
                return;
            }

            const itemCode = String(item.item_code || item.sku || '').trim();
            if (!itemCode) {
                showFlash('ID item kosong. Tidak boleh jana QR.', 'error');
                return;
            }

            currentQrItem = item;
            document.getElementById('qrItemNameText').textContent = item.item_name || item.category || 'Item';
            document.getElementById('qrItemCodeText').textContent = itemCode;

            const holder = document.getElementById('qrCodeHolder');
            holder.innerHTML = '';
            if (window.QRCode) {
                new QRCode(holder, {
                    text: itemCode,
                    width: 210,
                    height: 210,
                    colorDark: '#2b1d0e',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M,
                });
            } else {
                holder.innerHTML = '<div class="empty-text">Generator QR tidak tersedia.</div>';
            }

            document.getElementById('qrItemModal').classList.remove('hidden');
        }

        function closeQrItemModal() {
            document.getElementById('qrItemModal').classList.add('hidden');
        }

        function downloadCurrentQr() {
            if (!currentQrItem) return;
            const dataUrl = getQrDataUrl();
            if (!dataUrl) {
                showFlash('QR belum tersedia untuk dimuat turun.', 'error');
                return;
            }

            const code = String(currentQrItem.item_code || currentQrItem.sku || 'item');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `qr_${code}.png`;
            a.click();
        }

        function printCurrentQr() {
            if (!currentQrItem) return;
            const dataUrl = getQrDataUrl();
            if (!dataUrl) {
                showFlash('QR belum tersedia untuk print.', 'error');
                return;
            }

            const code = String(currentQrItem.item_code || currentQrItem.sku || '');
            const name = String(currentQrItem.item_name || currentQrItem.category || 'Item');
            const w = window.open('', '_blank', 'width=420,height=540');
            if (!w) {
                showFlash('Popup disekat browser. Benarkan popup untuk print.', 'error');
                return;
            }
            w.document.write(`<!DOCTYPE html><html><head><title>QR ${escapeHtml(code)}</title><style>body{font-family:Segoe UI,Tahoma,sans-serif;padding:22px;text-align:center;color:#2b1d0e}img{width:260px;height:260px;display:block;margin:10px auto}h2{margin:0 0 8px}p{margin:0 0 8px;color:#6b4e31}</style></head><body><h2>${escapeHtml(name)}</h2><p>${escapeHtml(code)}</p><img src="${dataUrl}" alt="QR ${escapeHtml(code)}"><script>window.onload=function(){window.print();}<\/script></body></html>`);
            w.document.close();
        }

        function getSortIndicator(key) {
            if (tableSortBy !== key) return '';
            return tableSortDir === 'asc' ? ' ↑' : ' ↓';
        }

        function setTableSort(key) {
            if (tableSortBy === key) {
                tableSortDir = tableSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                tableSortBy = key;
                tableSortDir = 'asc';
            }
            renderTable();
        }

        function hideImageHoverPreview() {
            if (!imageHoverPreview) return;
            imageHoverPreview.style.display = 'none';
        }

        function showImageHoverPreview(src, x, y) {
            if (!imageHoverPreview || !imageHoverPreviewImg || !src) return;
            imageHoverPreviewImg.src = src;

            const gap = 18;
            const boxW = 230;
            const boxH = 230;
            let left = x + gap;
            let top = y + gap;

            if (left + boxW > window.innerWidth - 10) {
                left = x - boxW - gap;
            }
            if (top + boxH > window.innerHeight - 10) {
                top = y - boxH - gap;
            }

            imageHoverPreview.style.left = `${Math.max(10, left)}px`;
            imageHoverPreview.style.top = `${Math.max(10, top)}px`;
            imageHoverPreview.style.display = 'block';
        }

        /* ── panel labels ── */
        const panelLabels = {
            dashboard:  'Dashboard',
            inventory:  'Inventory Items',
            history:    'Stock History',
            qr:         'Stock QR',
            returns:    'Returns & Damage',
            analytics:  'Analytics',
            settings:   'Settings',
        };

        function switchPanel(name) {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
            const targetPanel = document.getElementById('panel-' + name);
            if (targetPanel) targetPanel.classList.add('active');
            const targetBtn = document.querySelector(`.sb-item[data-panel="${name}"]`);
            if (targetBtn) targetBtn.classList.add('active');
            const topbar = document.getElementById('topbarTitle');
            if (topbar) topbar.textContent = panelLabels[name] || name;
            currentPanel = name;

            /* show/hide add button only on inventory */
            const addBtn = document.getElementById('addItemBtn');
            if (addBtn) addBtn.style.display = name === 'inventory' ? '' : 'none';

            if (name === 'history') loadStockHistory();
            if (name === 'qr') renderQrCart();
            if (name === 'returns') loadReturnsDamage();
            if (name === 'analytics') loadAnalytics();
        }

        function guardRole() {
            const user = <?php echo json_encode([
                'id' => $user['id'] ?? 1,
                'full_name' => $currentUserName,
                'username' => $user['username'] ?? $currentUserName,
                'email' => $currentUserEmail,
                'role' => $currentUserRole,
                'warehouse_id' => 1
            ]); ?>;
            const name = user.full_name || user.username || 'Admin Kaftan';
            const userChip = document.getElementById('userChip');
            if (userChip) userChip.textContent = name;
            const sbUser = document.getElementById('sbUser');
            if (sbUser) sbUser.textContent = name;
            const avatarEl = document.getElementById('sbAvatar');
            if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
            return user;
        }

        function showFlash(message, type = 'success') {
            flash.className = `flash show ${type}`;
            flash.textContent = message;
            setTimeout(() => {
                flash.className = 'flash';
                flash.textContent = '';
            }, 3000);
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        }

        function formatQty(v) {
            const n = Number(v || 0);
            return Number.isInteger(n) ? String(n) : n.toFixed(2);
        }

        function formatMoney(v) {
            const n = Number(v || 0);
            return `RM ${n.toFixed(2)}`;
        }

        function makeDetailRow(label, value) {
            return `
                <div class="detail-row">
                    <div class="detail-label">${escapeHtml(label)}</div>
                    <div class="detail-value">${escapeHtml(value || '-')}</div>
                </div>
            `;
        }

        function getItemShortDescription(item) {
            if (!item) return '-';
            return [
                item.item_name,
                item.variant_color ? `Warna ${item.variant_color}` : '',
                item.item_size ? `Size ${item.item_size}` : '',
            ].filter(Boolean).join(' · ') || item.category || '-';
        }

        function getItemLongDescription(item) {
            if (!item) return '-';
            return [
                item.item_name,
                item.category,
                item.item_type,
                item.variant_color ? `Warna ${item.variant_color}` : '',
                item.item_size ? `Size ${item.item_size}` : '',
            ].filter(Boolean).join(' • ') || '-';
        }

        function getComponentSpecRows(item) {
            return [];
        }

        function closeDetailModal() {
            document.getElementById('detailModal').classList.add('hidden');
        }

        function renderImagePreview(imageUrl) {
            const preview = document.getElementById('iImagePreview');
            const status = document.getElementById('iImageStatus');
            if (!preview || !status) return;

            if (imageUrl) {
                preview.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="Preview gambar item">`;
                status.textContent = imageUrl;
            } else {
                preview.textContent = 'No Image';
                status.textContent = 'Pilih gambar untuk upload.';
            }
        }

        async function uploadItemImage(file) {
            if (!file) return;

            const status = document.getElementById('iImageStatus');
            const imageUrlEl = document.getElementById('iImageUrl');
            const fileInput = document.getElementById('iImageFile');
            isUploadingImage = true;
            if (status) status.textContent = 'Sedang upload gambar...';

            try {
                const formData = new FormData();
                formData.append('image', file);

                const resp = await fetch(UPLOAD_API_URL, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });
                const result = await resp.json();
                if (!resp.ok || !result.success) {
                    throw new Error(result.message || 'Gagal upload gambar.');
                }

                imageUrlEl.value = result.image_url || '';
                renderImagePreview(imageUrlEl.value);
                showFlash(result.message || 'Gambar berjaya dimuat naik.', 'success');
            } catch (error) {
                if (status) status.textContent = error.message;
                if (fileInput) fileInput.value = '';
                throw error;
            } finally {
                isUploadingImage = false;
            }
        }

        function buildItemCodeFromFields(itemType, category, size, variantColor) {
            const cleanedType = String(itemType || '')
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .trim();

            if (!cleanedType) {
                return '';
            }

            const firstWord = cleanedType.split(/\s+/)[0] || '';
            let typeCode = firstWord.charAt(0) || '';

            if (firstWord === 'KAFTAN') {
                typeCode = 'K';
            } else if (firstWord === 'ABAYA') {
                typeCode = 'A';
            }

            if (!typeCode) {
                return '';
            }

            const prefix = 'KA';
            const codePrefix = `${prefix}-${typeCode}`;
            const existingCodes = (inventory.items || []).map((i) => String(i.item_code || i.sku || '').toUpperCase());
            const matcher = new RegExp(`^${codePrefix}(\\d+)$`);

            let maxNumber = 0;
            existingCodes.forEach((code) => {
                const match = code.match(matcher);
                if (!match) return;
                const num = Number(match[1] || 0);
                if (Number.isFinite(num) && num > maxNumber) {
                    maxNumber = num;
                }
            });

            return `${codePrefix}${maxNumber + 1}`;
        }

        function updateStats() {
            const s = inventory.stats || {};
            document.getElementById('sTotalItems').textContent = String(Number(s.total_items || 0));
            document.getElementById('sTotalUnits').textContent = formatQty(s.total_units || 0);
            document.getElementById('sLowStock').textContent = String(Number(s.low_stock_items || 0));
            document.getElementById('sOutStock').textContent = String(Number(s.out_of_stock || 0));
            const storeName = inventory.store?.name || '-';
            document.getElementById('sbStoreName').textContent = storeName;
        }

        function renderQrCart() {
            const cartList = document.getElementById('qrCartList');
            const cartCount = document.getElementById('qrCartCount');
            const cartModeText = document.getElementById('qrCartModeText');
            const cartStatus = document.getElementById('qrCartStatus');
            if (!cartList || !cartCount || !cartModeText || !cartStatus) return;

            cartCount.textContent = `${qrCart.length} items`;
            cartModeText.textContent = `Mode: ${qrMode === 'in' ? 'Stock In' : 'Stock Out'}`;

            document.querySelectorAll('[data-qr-mode]').forEach((btn) => {
                const mode = btn.getAttribute('data-qr-mode');
                btn.classList.toggle('active', mode === qrMode);
            });

            if (!qrCart.length) {
                cartList.innerHTML = '<div class="empty"><div class="empty-icon">🧺</div><div class="empty-text">Cart kosong. Scan item untuk tambah.</div></div>';
                cartStatus.textContent = '';
                return;
            }

            cartList.innerHTML = qrCart.map((entry) => {
                const item = entry.item;
                const imageUrl = String(item.image_url || '').trim();
                const imageCell = imageUrl
                    ? `<img class="item-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.category || item.item_name || 'Item')}" loading="lazy">`
                    : '<div class="item-thumb-placeholder">No Image</div>';
                return `
                    <div class="qr-cart-item">
                        <div>${imageCell}</div>
                        <div>
                            <div class="qr-cart-title">${escapeHtml(item.item_code || item.sku || '-')}</div>
                            <div class="qr-cart-meta">
                                ${escapeHtml(item.item_type || '-')} | ${escapeHtml(item.category || item.item_name || '-')}
                                <br>${escapeHtml(item.variant_color || '-')} / ${escapeHtml(item.item_size || '-')}
                                <br>Stok semasa: ${formatQty(item.quantity)} ${escapeHtml(item.unit || '')}
                            </div>
                        </div>
                        <div class="qr-qty-box">
                            <input class="input qr-qty-input" type="number" min="0.01" step="0.01" value="${escapeHtml(entry.qty)}" onchange="updateQrCartQty(${Number(item.id)}, this.value)">
                            <button class="btn btn-ghost" type="button" onclick="removeQrCartItem(${Number(item.id)})">Buang</button>
                        </div>
                    </div>
                `;
            }).join('');

            cartStatus.textContent = qrMode === 'in'
                ? 'Cart sedia untuk tambah stok masuk.'
                : 'Cart sedia untuk tolak stok keluar.';
        }

        function setQrMode(mode) {
            qrMode = mode === 'out' ? 'out' : 'in';
            renderQrCart();
        }

        function normalizeScanCode(value) {
            return String(value || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');
        }

        function findInventoryItemByCode(code) {
            const normalizedRaw = String(code || '').trim();
            if (!normalizedRaw) return null;

            const normalized = normalizeScanCode(normalizedRaw);
            if (!normalized) return null;

            const items = inventory.items || [];

            const exact = items.find((item) => {
                const itemCode = normalizeScanCode(item.item_code || item.sku || '');
                return itemCode && itemCode === normalized;
            });
            if (exact) return exact;

            const fuzzy = items.find((item) => {
                const itemCode = normalizeScanCode(item.item_code || item.sku || '');
                if (!itemCode) return false;
                return normalized.includes(itemCode) || itemCode.includes(normalized);
            });

            return fuzzy || null;
        }

        function addItemToQrCart(code) {
            const item = findInventoryItemByCode(code);
            if (!item) {
                throw new Error('ID item tidak ditemui dalam inventory.');
            }

            const existing = qrCart.find((entry) => Number(entry.item.id) === Number(item.id));
            if (existing) {
                existing.qty = String(Number(existing.qty || 0) + 1);
            } else {
                qrCart.unshift({ item, qty: '1' });
            }
            renderQrCart();
            return item;
        }

        function updateQrCartQty(itemId, value) {
            const entry = qrCart.find((row) => Number(row.item.id) === Number(itemId));
            if (!entry) return;
            const qty = Number(value || 0);
            entry.qty = qty > 0 ? String(qty) : '1';
            renderQrCart();
        }

        function removeQrCartItem(itemId) {
            qrCart = qrCart.filter((row) => Number(row.item.id) !== Number(itemId));
            renderQrCart();
        }

        function clearQrCart() {
            qrCart = [];
            renderQrCart();
        }

        async function submitQrCart() {
            if (!qrCart.length) {
                throw new Error('Cart masih kosong.');
            }

            const note = document.getElementById('qrCartNote').value.trim();
            const payload = {
                action: 'adjust_stock_bulk',
                movement_type: qrMode,
                note,
                items: qrCart.map((entry) => ({
                    item_id: Number(entry.item.id),
                    qty: Number(entry.qty || 0),
                })),
            };

            const resp = await fetch(`\${API_URL}?warehouse_id=\${WAREHOUSE_ID}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.message || 'Gagal update stock melalui QR.');
            }

            inventory = result.inventory || inventory;
            updateStats();
            renderCategories();
            renderTable();
            clearQrCart();
            document.getElementById('qrCartNote').value = '';
            await loadStockHistory();
            showFlash(result.message || 'Stock berjaya dikemaskini.', 'success');
        }

        async function handleQrManualAdd() {
            const input = document.getElementById('qrScanInput');
            const code = input.value.trim();
            if (!code) return;
            const item = addItemToQrCart(code);
            input.value = '';
            showFlash(`Item dimasukkan ke cart: ${item.item_code || item.sku || item.item_name}`, 'success');
        }

        async function stopQrCamera() {
            if (qrScannerTimer) {
                clearInterval(qrScannerTimer);
                qrScannerTimer = null;
            }
            if (qrCameraStream) {
                qrCameraStream.getTracks().forEach((track) => track.stop());
                qrCameraStream = null;
            }
            const video = document.getElementById('qrVideo');
            const empty = document.getElementById('qrCameraEmpty');
            const status = document.getElementById('qrCameraStatus');
            if (video) {
                video.srcObject = null;
                video.classList.remove('active');
            }
            if (empty) empty.style.display = '';
            if (status) status.textContent = 'Camera dihentikan.';
        }

        async function scanQrFrame() {
            if (!qrCameraStream || typeof BarcodeDetector === 'undefined') return;
            const video = document.getElementById('qrVideo');
            const status = document.getElementById('qrCameraStatus');
            if (!video || video.readyState < 2) return;

            try {
                const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8'] });
                const barcodes = await detector.detect(video);
                if (!barcodes.length) return;
                const rawValue = String(barcodes[0].rawValue || '').trim();
                if (!rawValue) return;
                addItemToQrCart(rawValue);
                if (status) status.textContent = `Scan berjaya: ${rawValue}`;
            } catch (error) {
                if (status) status.textContent = 'Camera scanner tidak tersedia pada browser ini.';
                await stopQrCamera();
            }
        }

        async function startQrCamera() {
            const status = document.getElementById('qrCameraStatus');
            const video = document.getElementById('qrVideo');
            const empty = document.getElementById('qrCameraEmpty');
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Browser ini tidak menyokong camera scanner.');
            }

            await stopQrCamera();

            qrCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            if (video) {
                video.srcObject = qrCameraStream;
                video.classList.add('active');
                await video.play();
            }
            if (empty) empty.style.display = 'none';
            if (status) {
                status.textContent = typeof BarcodeDetector === 'undefined'
                    ? 'Camera aktif tetapi BarcodeDetector tiada. Guna scanner manual jika scan tidak berfungsi.'
                    : 'Camera aktif. Halakan QR atau barcode ke kamera.';
            }

            if (typeof BarcodeDetector !== 'undefined') {
                qrScannerTimer = window.setInterval(() => {
                    scanQrFrame().catch(() => {});
                }, 1200);
            }
        }

        async function loadStockHistory() {
            const hw = document.getElementById('historyWrap');
            hw.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>';
            try {
                const resp = await fetch(`\${API_URL}?action=get_history&warehouse_id=\${WAREHOUSE_ID}`, { credentials: 'include' });
                const result = await resp.json();
                if (!resp.ok || !result.success) throw new Error(result.message || 'Gagal memuatkan history.');
                const rows = result.movements || [];
                if (!rows.length) { hw.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Tiada rekod pergerakan stok.</div></div>'; return; }
                hw.innerHTML = `
                    <table>
                        <thead><tr>
                            <th>Gambar</th><th>Tarikh</th><th>ID Item</th><th>Type</th><th>Category</th><th>Variant / Size</th><th>Jenis</th><th>Qty</th><th>Unit Price</th><th>Selling Price</th><th>Nota</th>
                        </tr></thead>
                        <tbody>
                            ${rows.map(r => {
                                const typeLabel = r.movement_type === 'in' ? '⬆ Stock In' : r.movement_type === 'out' ? '⬇ Stock Out' : '↔ Adjust';
                                const typeColor = r.movement_type === 'in' ? 'color:var(--green)' : r.movement_type === 'out' ? 'color:var(--maroon)' : 'color:var(--amber)';
                                const imageUrl = String(r.image_url || '').trim();
                                const imageCell = imageUrl
                                    ? `<img class="item-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(r.category || r.item_name || 'Item')}" loading="lazy">`
                                    : '<div class="item-thumb-placeholder">No Image</div>';
                                const variantSize = [r.variant_color || '-', r.item_size || '-'].join(' / ');
                                return `<tr>
                                    <td>${imageCell}</td>
                                    <td>${escapeHtml(r.created_at || '-')}</td>
                                    <td>${escapeHtml(r.item_code || r.sku || '-')}</td>
                                    <td>${escapeHtml(r.item_type || '-')}</td>
                                    <td>${escapeHtml(r.category || r.item_name || '-')}</td>
                                    <td>${escapeHtml(variantSize)}</td>
                                    <td style="${typeColor};font-weight:700;">${typeLabel}</td>
                                    <td>${formatQty(r.quantity)} ${escapeHtml(r.unit || '')}</td>
                                    <td>${formatMoney(r.unit_price || 0)}</td>
                                    <td>${formatMoney(r.selling_price || 0)}</td>
                                    <td>${escapeHtml(r.note || '-')}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>`;
            } catch (e) {
                hw.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">${escapeHtml(e.message)}</div></div>`;
            }
        }

        function renderReturnsDamageItemOptions() {
            const select = document.getElementById('rdItemSelect');
            if (!select) return;

            const prevValue = select.value;
            const items = [...(inventory.items || [])].sort((a, b) => {
                const ac = String(a.item_code || a.sku || '').toLowerCase();
                const bc = String(b.item_code || b.sku || '').toLowerCase();
                return ac.localeCompare(bc);
            });

            select.innerHTML = '<option value="">Pilih item</option>' + items.map((item) => {
                const code = item.item_code || item.sku || '-';
                const label = `${code} - ${item.category || item.item_name || '-'} (${formatQty(item.quantity)} ${item.unit || ''})`;
                return `<option value="${Number(item.id)}">${escapeHtml(label)}</option>`;
            }).join('');

            if (prevValue && items.some((x) => Number(x.id) === Number(prevValue))) {
                select.value = prevValue;
            }
        }

        async function loadReturnsDamage() {
            const wrap = document.getElementById('rdWrap');
            if (!wrap) return;

            renderReturnsDamageItemOptions();
            wrap.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan rekod return/damage...</div></div>';

            try {
                const resp = await fetch(`\${API_URL}?action=get_returns_damage&warehouse_id=\${WAREHOUSE_ID}`, { credentials: 'include' });
                const result = await resp.json();
                if (!resp.ok || !result.success) {
                    throw new Error(result.message || 'Gagal memuatkan rekod return/damage.');
                }

                const rows = result.records || [];
                if (!rows.length) {
                    wrap.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-text">Belum ada rekod return/damage.</div></div>';
                    return;
                }

                wrap.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Tarikh</th>
                                <th>ID Item</th>
                                <th>Type</th>
                                <th>Category</th>
                                <th>Variant / Size</th>
                                <th>Jenis Rekod</th>
                                <th>Qty</th>
                                <th>Stok Sebelum</th>
                                <th>Stok Selepas</th>
                                <th>Nota</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((r) => {
                                const isReturn = String(r.record_type || '') === 'return';
                                const typeText = isReturn ? '↩ Return' : '⚠ Damage';
                                const typeStyle = isReturn
                                    ? 'color:var(--green);font-weight:700;'
                                    : 'color:var(--maroon);font-weight:700;';
                                return `
                                    <tr>
                                        <td>${escapeHtml(r.created_at || '-')}</td>
                                        <td>${escapeHtml(r.item_code || r.sku || '-')}</td>
                                        <td>${escapeHtml(r.item_type || '-')}</td>
                                        <td>${escapeHtml(r.category || r.item_name || '-')}</td>
                                        <td>${escapeHtml((r.variant_color || '-') + ' / ' + (r.item_size || '-'))}</td>
                                        <td style="${typeStyle}">${typeText}</td>
                                        <td>${formatQty(r.qty)} ${escapeHtml(r.unit || '')}</td>
                                        <td>${formatQty(r.qty_before)} ${escapeHtml(r.unit || '')}</td>
                                        <td>${formatQty(r.qty_after)} ${escapeHtml(r.unit || '')}</td>
                                        <td>${escapeHtml(r.note || '-')}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            } catch (error) {
                wrap.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">${escapeHtml(error.message)}</div></div>`;
            }
        }

        async function loadAnalytics() {
            const ids = ['aCatWrap', 'aTopWrap', 'aMoveWrap', 'aRdWrap', 'aTopInWrap', 'aTopOutWrap'];
            ids.forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Memuatkan...</div></div>';
            });
            ['aKpiCost', 'aKpiSell', 'aKpiProfit', 'aKpiAlert'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.textContent = '—';
            });

            try {
                const resp = await fetch(`\${API_URL}?action=get_analytics&warehouse_id=\${WAREHOUSE_ID}`, { credentials: 'include' });
                const result = await resp.json();
                if (!resp.ok || !result.success) {
                    throw new Error(result.message || 'Gagal memuatkan analytics.');
                }

                const kpi = result.kpi || {};
                const categories = result.categories || [];
                const topItems    = result.top_items    || [];
                const topStockIn  = result.top_stock_in  || [];
                const topStockOut = result.top_stock_out || [];
                const movements = result.movements  || {};
                const rdSummary = result.rd_summary || {};

                // ── KPI cards ──
                const elCost   = document.getElementById('aKpiCost');
                const elSell   = document.getElementById('aKpiSell');
                const elProfit = document.getElementById('aKpiProfit');
                const elAlert  = document.getElementById('aKpiAlert');
                if (elCost)   elCost.textContent   = formatMoney(kpi.total_cost_value || 0);
                if (elSell)   elSell.textContent   = formatMoney(kpi.total_sell_value || 0);
                if (elProfit) {
                    elProfit.textContent = formatMoney(kpi.potential_profit || 0);
                    elProfit.style.color = (kpi.potential_profit || 0) >= 0 ? 'var(--green)' : 'var(--maroon)';
                }
                if (elAlert) {
                    elAlert.textContent = `${kpi.low_stock || 0} / ${kpi.out_of_stock || 0}`;
                }

                // ── Category breakdown ──
                const catWrap = document.getElementById('aCatWrap');
                if (catWrap) {
                    if (!categories.length) {
                        catWrap.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-text">Tiada kategori ditemui.</div></div>';
                    } else {
                        const maxQty = Math.max(...categories.map((c) => c.total_qty), 1);
                        catWrap.innerHTML = `<div class="analytics-bar-wrap">` +
                            categories.map((c) => {
                                const pct = Math.round((c.total_qty / maxQty) * 100);
                                return `
                                    <div class="analytics-bar-row">
                                        <div class="analytics-bar-label" title="${escapeHtml(c.category)}">${escapeHtml(c.category)}</div>
                                        <div class="analytics-bar-track">
                                            <div class="analytics-bar-fill" style="width:${pct}%"></div>
                                        </div>
                                        <div class="analytics-bar-val">${formatQty(c.total_qty)} unit</div>
                                    </div>`;
                            }).join('') + `</div>
                            <div style="margin-top:12px;font-size:12px;color:var(--muted);text-align:right;">${categories.length} kategori</div>`;
                    }
                }

                // ── Top 5 items ──
                const topWrap = document.getElementById('aTopWrap');
                if (topWrap) {
                    if (!topItems.length) {
                        topWrap.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-text">Tiada item ditemui.</div></div>';
                    } else {
                        topWrap.innerHTML = topItems.map((item, idx) => `
                            <div class="top-item-row">
                                <div class="top-item-rank">${idx + 1}</div>
                                <div class="top-item-info">
                                    <div class="top-item-code">${escapeHtml(item.item_code || item.sku || '-')}</div>
                                    <div class="top-item-meta">${escapeHtml(item.category || '-')} · ${escapeHtml(item.item_type || '-')} · ${escapeHtml(item.variant_color || '-')} / ${escapeHtml(item.item_size || '-')}</div>
                                </div>
                                <div class="top-item-qty">${formatQty(item.quantity)} ${escapeHtml(item.unit || '')}</div>
                            </div>`).join('');
                    }
                }

                // ── Movement last 30 days ──
                const moveWrap = document.getElementById('aMoveWrap');
                if (moveWrap) {
                    const mv = (type) => movements[type] || { count: 0, total_qty: 0 };
                    moveWrap.innerHTML = `<div class="analytics-move-grid">
                        <div class="analytics-move-card">
                            <div class="move-icon">⬇</div>
                            <div class="move-label">Stock In</div>
                            <div class="move-val" style="color:var(--green);">${mv('in').count}</div>
                            <div class="move-sub">${formatQty(mv('in').total_qty)} unit</div>
                        </div>
                        <div class="analytics-move-card">
                            <div class="move-icon">⬆</div>
                            <div class="move-label">Stock Out</div>
                            <div class="move-val" style="color:var(--maroon);">${mv('out').count}</div>
                            <div class="move-sub">${formatQty(mv('out').total_qty)} unit</div>
                        </div>
                        <div class="analytics-move-card">
                            <div class="move-icon">↔</div>
                            <div class="move-label">Adjust</div>
                            <div class="move-val" style="color:var(--amber);">${mv('adjust').count}</div>
                            <div class="move-sub">${formatQty(mv('adjust').total_qty)} unit</div>
                        </div>
                    </div>
                    <div style="margin-top:10px;font-size:12px;color:var(--muted);text-align:right;">Data 30 hari terakhir</div>`;
                }

                // ── Returns & Damage summary ──
                const rdWrapA = document.getElementById('aRdWrap');
                if (rdWrapA) {
                    const ret = rdSummary['return'] || { count: 0, total_qty: 0 };
                    const dmg = rdSummary['damage'] || { count: 0, total_qty: 0 };
                    rdWrapA.innerHTML = `<div class="analytics-rd-grid">
                        <div class="analytics-rd-card return-card">
                            <div class="analytics-rd-icon">↩</div>
                            <div class="analytics-rd-label">Return</div>
                            <div class="analytics-rd-val">${ret.count}</div>
                            <div class="analytics-rd-sub">${formatQty(ret.total_qty)} unit dikembalikan</div>
                        </div>
                        <div class="analytics-rd-card damage-card">
                            <div class="analytics-rd-icon">⚠</div>
                            <div class="analytics-rd-label">Damage</div>
                            <div class="analytics-rd-val">${dmg.count}</div>
                            <div class="analytics-rd-sub">${formatQty(dmg.total_qty)} unit rosak/hilang</div>
                        </div>
                    </div>`;
                }

                // ── Top 5 Stock In ──
                function renderTopMovementList(wrap, items, qtyKey, color, emptyMsg) {
                    if (!wrap) return;
                    if (!items.length) {
                        wrap.innerHTML = `<div class="empty"><div class="empty-icon">📦</div><div class="empty-text">${emptyMsg}</div></div>`;
                        return;
                    }
                    const max = Math.max(...items.map((x) => x[qtyKey]), 1);
                    wrap.innerHTML = items.map((item, idx) => {
                        const pct = Math.round((item[qtyKey] / max) * 100);
                        return `
                            <div class="top-item-row">
                                <div class="top-item-rank">${idx + 1}</div>
                                <div class="top-item-info">
                                    <div class="top-item-code">${escapeHtml(item.item_code || item.sku || '-')}</div>
                                    <div class="top-item-meta">${escapeHtml(item.category || '-')} · ${escapeHtml(item.item_type || '-')} · ${escapeHtml(item.variant_color || '-')} / ${escapeHtml(item.item_size || '-')}</div>
                                    <div class="analytics-bar-track" style="margin-top:5px;">
                                        <div class="analytics-bar-fill ${color}" style="width:${pct}%"></div>
                                    </div>
                                </div>
                                <div class="top-item-qty" style="color:var(--${color === 'green' ? 'green' : 'maroon'});">${formatQty(item[qtyKey])} ${escapeHtml(item.unit || '')}</div>
                            </div>`;
                    }).join('');
                }

                renderTopMovementList(document.getElementById('aTopInWrap'),  topStockIn,  'total_in',  'green', 'Tiada rekod stock in.');
                renderTopMovementList(document.getElementById('aTopOutWrap'), topStockOut, 'total_out', 'red',   'Tiada rekod stock out.');

            } catch (error) {
                ids.forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">${escapeHtml(error.message)}</div></div>`;
                });
            }
        }

        async function saveReturnDamage() {
            const itemId = Number(document.getElementById('rdItemSelect').value || 0);
            const recordType = document.getElementById('rdType').value;
            const qty = Number(document.getElementById('rdQty').value || 0);
            const note = document.getElementById('rdNote').value.trim();

            if (!itemId) {
                throw new Error('Sila pilih item dahulu.');
            }
            if (!['return', 'damage'].includes(recordType)) {
                throw new Error('Jenis rekod tidak sah.');
            }
            if (!(qty > 0)) {
                throw new Error('Kuantiti mesti lebih besar dari 0.');
            }

            const resp = await fetch(`\${API_URL}?warehouse_id=\${WAREHOUSE_ID}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_return_damage',
                    item_id: itemId,
                    record_type: recordType,
                    qty,
                    note,
                }),
            });

            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.message || 'Gagal simpan rekod return/damage.');
            }

            inventory = result.inventory || inventory;
            updateStats();
            renderCategories();
            renderTable();
            renderReturnsDamageItemOptions();

            document.getElementById('rdQty').value = '';
            document.getElementById('rdNote').value = '';

            await Promise.all([
                loadReturnsDamage(),
                loadStockHistory(),
            ]);

            showFlash(result.message || 'Rekod return/damage berjaya disimpan.', 'success');
        }

        function renderCategories() {
            const categories = Array.isArray(inventory.categories) ? inventory.categories : [];
            const dedupedCategories = [];
            const seen = new Set();
            const dedupedTypes = [];
            const seenTypes = new Set();

            categories.forEach((raw) => {
                const value = String(raw || '').trim();
                if (!value) return;
                const key = value.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                dedupedCategories.push(value);
            });

            (inventory.items || []).forEach((item) => {
                const value = String(item.item_type || '').trim();
                if (!value) return;
                const key = value.toLowerCase();
                if (seenTypes.has(key)) return;
                seenTypes.add(key);
                dedupedTypes.push(value);
            });

            categoryFilter.innerHTML = '<option value="">Semua Kategori</option>' + dedupedCategories
                .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
                .join('');

            if (categorySuggestionList) {
                categorySuggestionList.innerHTML = dedupedCategories
                    .map((c) => `<option value="${escapeHtml(c)}"></option>`)
                    .join('');
            }

            if (typeFilter) {
                typeFilter.innerHTML = '<option value="">Semua Type</option>' + dedupedTypes
                    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
                    .join('');
            }
        }

        function renderTable() {
            const keyword = (searchInput.value || '').trim().toLowerCase();
            const itemType = (typeFilter?.value || '').trim().toLowerCase();
            const category = (categoryFilter.value || '').trim().toLowerCase();
            const stock = (stockFilter.value || '').trim();
            const sortBy = tableSortBy;
            const sortDir = tableSortDir === 'desc' ? -1 : 1;

            const filtered = (inventory.items || []).filter((item) => {
                const blob = `${item.item_code || item.sku || ''} ${item.item_name || ''} ${item.category || ''} ${item.item_type || ''} ${item.item_size || ''} ${item.variant_color || ''}`.toLowerCase();
                const hitKeyword = !keyword || blob.includes(keyword);
                const hitType = !itemType || String(item.item_type || '').toLowerCase() === itemType;
                const hitCategory = !category || String(item.category || '').toLowerCase() === category;
                const isLow = Number(item.is_low_stock || 0) === 1;
                const isOut = Number(item.quantity || 0) <= 0;
                const hitStock = !stock || (stock === 'low' ? isLow : isOut);
                return hitKeyword && hitType && hitCategory && hitStock;
            });

            const sorted = [...filtered].sort((a, b) => {
                const str = (v) => String(v == null ? '' : v).toLowerCase();
                const num = (v) => Number(v || 0);
                const dt = (v) => {
                    const t = Date.parse(String(v || ''));
                    return Number.isNaN(t) ? 0 : t;
                };

                let av = 0;
                let bv = 0;

                switch (sortBy) {
                    case 'type':
                        return str(a.item_type).localeCompare(str(b.item_type)) * sortDir;
                    case 'category':
                        return str(a.category).localeCompare(str(b.category)) * sortDir;
                    case 'variant':
                        return str(a.variant_color).localeCompare(str(b.variant_color)) * sortDir;
                    case 'size':
                        return str(a.item_size).localeCompare(str(b.item_size)) * sortDir;
                    case 'unit_price':
                        av = num(a.unit_price); bv = num(b.unit_price); break;
                    case 'selling_price':
                        av = num(a.selling_price); bv = num(b.selling_price); break;
                    case 'qty':
                        av = num(a.quantity); bv = num(b.quantity); break;
                    case 'min_qty':
                        av = num(a.minimum_quantity); bv = num(b.minimum_quantity); break;
                    case 'last_movement':
                        av = dt(a.last_movement_at); bv = dt(b.last_movement_at); break;
                    case 'id_item':
                    default:
                        return str(a.item_code || a.sku).localeCompare(str(b.item_code || b.sku)) * sortDir;
                }

                if (av === bv) return 0;
                return av > bv ? sortDir : -sortDir;
            });

            if (!filtered.length) {
                tableWrap.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-text">Tiada item inventory ditemui.</div></div>';
                return;
            }

            tableWrap.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Gambar</th>
                            <th class="sortable-th" onclick="setTableSort('id_item')">ID Item${getSortIndicator('id_item')}</th>
                            <th class="sortable-th" onclick="setTableSort('type')">Type${getSortIndicator('type')}</th>
                            <th class="sortable-th" onclick="setTableSort('category')">Category ${getSortIndicator('category')}</th>
                            <th class="sortable-th" onclick="setTableSort('variant')">Variant${getSortIndicator('variant')}</th>
                            <th class="sortable-th" onclick="setTableSort('size')">Size${getSortIndicator('size')}</th>
                            <th class="sortable-th" onclick="setTableSort('unit_price')">Unit Price${getSortIndicator('unit_price')}</th>
                            <th class="sortable-th" onclick="setTableSort('selling_price')">Selling Price${getSortIndicator('selling_price')}</th>
                            <th class="sortable-th" onclick="setTableSort('qty')">Qty${getSortIndicator('qty')}</th>
                            <th class="sortable-th" onclick="setTableSort('min_qty')">Min Qty${getSortIndicator('min_qty')}</th>
                            <th>Status</th>
                            <th class="sortable-th" onclick="setTableSort('last_movement')">Last Movement${getSortIndicator('last_movement')}</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((item) => {
                            const qty = Number(item.quantity || 0);
                            const min = Number(item.minimum_quantity || 0);
                            const low = Number(item.is_low_stock || 0) === 1;
                            const out = qty <= 0;
                            const statusClass = out ? 'pill-out' : (low ? 'pill-low' : 'pill-ok');
                            const statusText = out ? 'Out Of Stock' : (low ? 'Low Stock' : 'Normal');
                            const imageUrl = String(item.image_url || '').trim();
                            const imageCell = imageUrl
                                ? `<img class="item-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.category || item.item_name || 'Kaftan Item')}" loading="lazy">`
                                : '<div class="item-thumb-placeholder">No Image</div>';

                            return `
                                <tr>
                                    <td>${imageCell}</td>
                                    <td>${escapeHtml(item.item_code || item.sku || '-')}</td>
                                    <td>${escapeHtml(item.item_type || '-')}</td>
                                    <td>${escapeHtml(item.category || '-')}</td>
                                    <td>${escapeHtml(item.variant_color || '-')}</td>
                                    <td>${escapeHtml(item.item_size || '-')}</td>
                                    <td>${formatMoney(item.unit_price)}</td>
                                    <td>${formatMoney(item.selling_price)}</td>
                                    <td>${formatQty(qty)} ${escapeHtml(item.unit || '')}</td>
                                    <td>${formatQty(min)}</td>
                                    <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                                    <td>${escapeHtml(item.last_movement_at || '-')}</td>
                                    <td>
                                        <div class="row-actions">
                                            <button class="btn-inner-ghost" type="button" onclick="openDetailModal(${Number(item.id)})">View</button>
                                            <button class="btn-inner-ghost" type="button" onclick="editItem(${Number(item.id)})">Edit</button>
                                            <button class="btn-inner-ghost" type="button" onclick="openQrItemModal(${Number(item.id)})">QR</button>
                                            <button class="btn-inner-green" type="button" onclick="openStockMove(${Number(item.id)}, 'in')">Stock In</button>
                                            <button class="btn-inner-red" type="button" onclick="openStockMove(${Number(item.id)}, 'out')">Stock Out</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        async function fetchInventory() {
            const resp = await fetch(`\${API_URL}?warehouse_id=\${WAREHOUSE_ID}`, { credentials: 'include' });
            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.message || 'Gagal memuatkan inventory.');
            }
            inventory = result.inventory || { store: null, stats: {}, items: [], categories: [] };
            updateStats();
            renderCategories();
            renderTable();
            renderReturnsDamageItemOptions();
        }

        async function saveItem() {
            const isCreate = editingItemId <= 0;
            const itemCodeInput = document.getElementById('iSku').value.trim();
            const itemType = document.getElementById('iType').value.trim();
            const itemSize = document.getElementById('iSize').value.trim();
            const category = document.getElementById('iCategory').value.trim();
            const variantColor = document.getElementById('iVariantColor').value.trim();
            const imageUrl = document.getElementById('iImageUrl').value.trim();
            const itemNameInput = document.getElementById('iName').value.trim();
            const unit = document.getElementById('iUnit').value.trim() || 'unit';
            const quantity = Number(document.getElementById('iQty').value || 0);
            const minimum = Number(document.getElementById('iMinQty').value || 0);
            const unitPrice = Number(document.getElementById('iUnitPrice').value || 0);
            const sellingPrice = Number(document.getElementById('iSellingPrice').value || 0);

            if (isUploadingImage) {
                throw new Error('Tunggu upload gambar selesai dahulu.');
            }

            const autoItemCode = buildItemCodeFromFields(itemType, category, itemSize, variantColor);
            const itemCode = itemCodeInput || autoItemCode;
            const itemName = itemNameInput || [itemType, category, variantColor].filter(Boolean).join(' ').trim();

            if (!itemCode) {
                throw new Error('Isi Type untuk auto-generate ID item.');
            }

            if (!itemName) {
                throw new Error('Nama item tidak boleh kosong.');
            }

            const payload = editingItemId > 0
                ? {
                    action: 'update_item',
                    item_id: editingItemId,
                    item_name: itemName,
                    category,
                    item_type: itemType,
                    item_size: itemSize,
                    variant_color: variantColor,
                    image_url: imageUrl,
                    unit,
                    unit_price: unitPrice,
                    selling_price: sellingPrice,
                    minimum_quantity: minimum,
                }
                : {
                    action: 'create_item',
                    item_code: itemCode,
                    item_name: itemName,
                    category,
                    item_type: itemType,
                    item_size: itemSize,
                    variant_color: variantColor,
                    image_url: imageUrl,
                    unit,
                    unit_price: unitPrice,
                    selling_price: sellingPrice,
                    quantity,
                    minimum_quantity: minimum,
                };

            const resp = await fetch(`\${API_URL}?warehouse_id=\${WAREHOUSE_ID}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.message || 'Gagal menyimpan item.');
            }

            inventory = result.inventory || inventory;
            closeItemModal();
            updateStats();
            renderCategories();
            renderTable();
            showFlash(result.message || 'Item berjaya disimpan.', 'success');

            if (isCreate) {
                const created = (inventory.items || []).find((x) => String(x.item_code || x.sku || '').toLowerCase() === String(itemCode).toLowerCase());
                if (created) {
                    openQrItemModal(Number(created.id));
                }
            }
        }


        async function deleteCurrentItem() {
            if (editingItemId <= 0) {
                showFlash('Sila pilih item untuk dipadam.', 'error');
                return;
            }

            const item = (inventory.items || []).find((x) => Number(x.id) === Number(editingItemId));
            const itemCode = String(item?.item_code || item?.sku || '-');
            const itemName = String(item?.item_name || '-');

            const firstConfirm = window.confirm(
                `AMARAN: Anda pasti mahu padam item ini?\n\nID: ${itemCode}\nNama: ${itemName}`
            );
            if (!firstConfirm) return;

            const secondConfirm = window.confirm(
                'Tindakan ini TIDAK BOLEH diundur. Rekod item akan dipadam secara kekal bersama rekod berkaitan.\n\nTekan OK hanya jika anda benar-benar pasti.'
            );
            if (!secondConfirm) return;

            const typed = window.prompt(`Untuk teruskan, taip semula ID item ini:\n${itemCode}`) || '';
            if (typed.trim() !== itemCode) {
                showFlash('Padam dibatalkan. ID item tidak sepadan.', 'error');
                return;
            }

            const resp = await fetch(`\${API_URL}?warehouse_id=\${WAREHOUSE_ID}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_item',
                    item_id: editingItemId,
                }),
            });
            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.message || 'Gagal memadam item.');
            }

            inventory = result.inventory || inventory;
            closeItemModal();
            updateStats();
            renderCategories();
            renderTable();
            showFlash(result.message || 'Item berjaya dipadam.', 'success');
        }

        async function saveStockMove() {
            const moveType = document.getElementById('mType').value;
            const qty = Number(document.getElementById('mQty').value || 0);
            const note = document.getElementById('mNote').value.trim();

            const resp = await fetch(`\${API_URL}?warehouse_id=\${WAREHOUSE_ID}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'adjust_stock',
                    item_id: activeMoveItemId,
                    movement_type: moveType,
                    qty,
                    note,
                }),
            });
            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.message || 'Gagal kemaskini stok.');
            }

            inventory = result.inventory || inventory;
            closeStockModal();
            updateStats();
            renderCategories();
            renderTable();
            showFlash(result.message || 'Stok berjaya dikemaskini.', 'success');
        }

        function openItemModal(isEdit = false) {
            const modal = document.getElementById('itemModal');
            const skuField = document.getElementById('iSkuField');
            document.getElementById('itemModalTitle').textContent = isEdit ? 'Edit Item' : 'Tambah Item';
            document.getElementById('iSku').disabled = isEdit;
            if (skuField) {
                skuField.style.display = 'none';
            }
            document.getElementById('itemDeleteBtn').style.display = isEdit ? 'inline-flex' : 'none';
            modal.classList.remove('hidden');
        }

        function closeItemModal() {
            editingItemId = 0;
            document.getElementById('itemModal').classList.add('hidden');
            const skuField = document.getElementById('iSkuField');
            if (skuField) {
                skuField.style.display = 'none';
            }
            document.getElementById('iSku').value = '';
            document.getElementById('iName').value = '';
            document.getElementById('iType').value = '';
            document.getElementById('iSize').value = '';
            document.getElementById('iCategory').value = '';
            document.getElementById('iVariantColor').value = '';
            document.getElementById('iImageUrl').value = '';
            document.getElementById('iImageFile').value = '';
            document.getElementById('iUnit').value = 'unit';
            document.getElementById('iQty').value = '0';
            document.getElementById('iMinQty').value = '0';
            document.getElementById('iUnitPrice').value = '0';
            document.getElementById('iSellingPrice').value = '0';
            document.getElementById('iSku').disabled = false;
            document.getElementById('itemDeleteBtn').style.display = 'none';
            renderImagePreview('');
        }


        function openDetailModal(itemId) {
            const item = (inventory.items || []).find((x) => Number(x.id) === Number(itemId));
            if (!item) {
                showFlash('Item tidak ditemui.', 'error');
                return;
            }

            activeDetailItemId = Number(item.id);

            const qty = Number(item.quantity || 0);
            const low = Number(item.is_low_stock || 0) === 1;
            const out = qty <= 0;
            const statusText = out ? 'Out Of Stock' : (low ? 'Low Stock' : 'Normal');
            const detailImage = document.getElementById('detailImage');
            const detailChipRow = document.getElementById('detailChipRow');
            const detailName = document.getElementById('detailName');
            const detailDescription = document.getElementById('detailDescription');
            const detailGeneralList = document.getElementById('detailGeneralList');
            const detailSpecList = document.getElementById('detailSpecList');

            if (detailImage) {
                detailImage.innerHTML = item.image_url
                    ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.item_name || item.category || 'Item')}">`
                    : 'No Image';
            }

            if (detailChipRow) {
                detailChipRow.innerHTML = [
                    item.item_type || '-',
                    item.category || '-',
                    statusText,
                    formatQty(qty),
                ].map((value) => `<span class="detail-chip">${escapeHtml(value)}</span>`).join('');
            }

            if (detailName) detailName.textContent = item.item_name || item.category || '-';
            if (detailDescription) detailDescription.textContent = getItemLongDescription(item);

            if (detailGeneralList) {
                detailGeneralList.innerHTML = [
                    makeDetailRow('Type', item.item_type || '-'),
                    makeDetailRow('Category', item.category || '-'),
                    makeDetailRow('Variant', item.variant_color || '-'),
                    makeDetailRow('Qty', formatQty(qty)),
                    makeDetailRow('Min Qty', formatQty(item.minimum_quantity || 0)),
                    makeDetailRow('Unit Price', formatMoney(item.unit_price || 0)),
                    makeDetailRow('Selling Price', formatMoney(item.selling_price || 0)),
                    makeDetailRow('Last Movement', item.last_movement_at || '-'),
                ].join('');
            }

            const specRows = [];
            if (String(item.item_type || '').toUpperCase() === 'PC') {
                specRows.push(makeDetailRow('Brand Laptop', item.pc_brand || '-'));
                specRows.push(makeDetailRow('Type Laptop', item.pc_device_type || '-'));
                specRows.push(makeDetailRow('Model', item.pc_model || '-'));
                specRows.push(makeDetailRow('Panel Type', item.panel_type || '-'));
                specRows.push(makeDetailRow('Port Interface', item.port_interface || '-'));
                specRows.push(makeDetailRow('Screen Size', item.screen_size || '-'));
                specRows.push(makeDetailRow('Graphic Chipset', item.graphics_chipset || '-'));
                specRows.push(makeDetailRow('Storage Capacity', item.storage_capacity || '-'));
                specRows.push(makeDetailRow('Storage Type', item.storage_type || '-'));
                specRows.push(makeDetailRow('Processor Type', item.processor_type || '-'));
            } else if (String(item.item_type || '').toUpperCase() === 'COMPONENT') {
                const componentRows = getComponentSpecRows(item);
                if (componentRows.length) {
                    componentRows.forEach((row) => specRows.push(makeDetailRow(row.label, row.value)));
                } else {
                    specRows.push(makeDetailRow('Description', getItemShortDescription(item)));
                }
            } else {
                specRows.push(makeDetailRow('Description', getItemShortDescription(item)));
                specRows.push(makeDetailRow('Store', inventory.store?.name || '-'));
            }

            if (detailSpecList) {
                detailSpecList.innerHTML = specRows.join('');
            }

            document.getElementById('detailModal').classList.remove('hidden');
        }

        function editItem(itemId) {
            const item = (inventory.items || []).find((x) => Number(x.id) === Number(itemId));
            if (!item) return;
            editingItemId = Number(item.id);
            document.getElementById('iSku').value = item.item_code || item.sku || '';
            document.getElementById('iName').value = item.item_name || '';
            document.getElementById('iType').value = item.item_type || '';
            document.getElementById('iSize').value = item.item_size || '';
            document.getElementById('iCategory').value = item.category || '';
            document.getElementById('iVariantColor').value = item.variant_color || '';
            document.getElementById('iImageUrl').value = item.image_url || '';
            document.getElementById('iImageFile').value = '';
            document.getElementById('iUnit').value = item.unit || 'unit';
            document.getElementById('iQty').value = Number(item.quantity || 0);
            document.getElementById('iMinQty').value = Number(item.minimum_quantity || 0);
            document.getElementById('iUnitPrice').value = Number(item.unit_price || 0);
            document.getElementById('iSellingPrice').value = Number(item.selling_price || 0);
            renderImagePreview(item.image_url || '');
            openItemModal(true);
        }

        function openStockMove(itemId, type) {
            activeMoveItemId = Number(itemId);
            document.getElementById('mType').value = type || 'in';
            document.getElementById('mQty').value = '';
            document.getElementById('mNote').value = '';
            document.getElementById('stockModal').classList.remove('hidden');
        }

        function closeStockModal() {
            activeMoveItemId = 0;
            document.getElementById('stockModal').classList.add('hidden');
            document.getElementById('mQty').value = '';
            document.getElementById('mNote').value = '';
        }

        function exportCsv() {
            const rows = [['ID Item', 'Type', 'Category', 'Variant', 'Size', 'Item Name', 'Image URL', 'Unit', 'Unit Price', 'Selling Price', 'Quantity', 'Minimum Quantity']];
            (inventory.items || []).forEach((item) => {
                rows.push([
                    item.item_code || item.sku || '',
                    item.item_type || '',
                    item.category || '',
                    item.variant_color || '',
                    item.item_size || '',
                    item.item_name || '',
                    item.image_url || '',
                    item.unit || '',
                    String(Number(item.unit_price || 0).toFixed(2)),
                    String(Number(item.selling_price || 0).toFixed(2)),
                    String(item.quantity ?? ''),
                    String(item.minimum_quantity ?? ''),
                ]);
            });

            const csv = rows
                .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
                .join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'inventory_kaftan.csv';
            a.click();
            URL.revokeObjectURL(url);
        }

        function manageCategory() {
            showFlash('Category ikut nilai pada item. Edit item untuk ubah kategori.', 'success');
        }

        document.getElementById('addItemBtn').addEventListener('click', () => openItemModal(false));
        document.getElementById('newItemBtn').addEventListener('click', () => openItemModal(false));
        document.getElementById('refreshBtn').addEventListener('click', async () => {
            try {
                await fetchInventory();
                if (currentPanel === 'returns') {
                    await loadReturnsDamage();
                }
                showFlash('Data inventory berjaya di-refresh.', 'success');
            } catch (error) {
                showFlash(error.message, 'error');
            }
        });
        document.getElementById('itemCancelBtn').addEventListener('click', closeItemModal);
        document.getElementById('itemDeleteBtn').addEventListener('click', async () => {
            try {
                await deleteCurrentItem();
            } catch (error) {
                showFlash(error.message, 'error');
            }
        });
        document.getElementById('stockCancelBtn').addEventListener('click', closeStockModal);
        document.getElementById('detailCloseBtn').addEventListener('click', closeDetailModal);
        document.getElementById('itemSaveBtn').addEventListener('click', async () => {
            try { await saveItem(); } catch (error) { showFlash(error.message, 'error'); }
        });
        document.getElementById('stockSaveBtn').addEventListener('click', async () => {
            try { await saveStockMove(); } catch (error) { showFlash(error.message, 'error'); }
        });
        document.getElementById('rdSaveBtn').addEventListener('click', async () => {
            try {
                await saveReturnDamage();
            } catch (error) {
                showFlash(error.message, 'error');
            }
        });
        document.getElementById('qrModalCloseBtn').addEventListener('click', closeQrItemModal);
        document.getElementById('qrDownloadBtn').addEventListener('click', downloadCurrentQr);
        document.getElementById('qrPrintBtn').addEventListener('click', printCurrentQr);
        document.getElementById('exportBtn').addEventListener('click', exportCsv);
        document.getElementById('manageCategoryBtn').addEventListener('click', manageCategory);
        document.querySelectorAll('[data-qr-mode]').forEach((btn) => {
            btn.addEventListener('click', () => setQrMode(btn.getAttribute('data-qr-mode')));
        });
        document.getElementById('qrAddBtn').addEventListener('click', async () => {
            try {
                await handleQrManualAdd();
            } catch (error) {
                showFlash(error.message, 'error');
            }
        });
        document.getElementById('qrClearInputBtn').addEventListener('click', () => {
            document.getElementById('qrScanInput').value = '';
        });
        document.getElementById('qrScanInput').addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            try {
                await handleQrManualAdd();
            } catch (error) {
                showFlash(error.message, 'error');
            }
        });
        document.getElementById('qrClearCartBtn').addEventListener('click', clearQrCart);
        document.getElementById('qrSubmitBtn').addEventListener('click', async () => {
            try {
                await submitQrCart();
            } catch (error) {
                showFlash(error.message, 'error');
            }
        });
        document.getElementById('startCameraBtn').addEventListener('click', async () => {
            try {
                await startQrCamera();
            } catch (error) {
                showFlash(error.message, 'error');
                document.getElementById('qrCameraStatus').textContent = error.message;
            }
        });
        document.getElementById('stopCameraBtn').addEventListener('click', () => {
            stopQrCamera().catch(() => {});
        });
        document.getElementById('refreshCameraBtn').addEventListener('click', async () => {
            try {
                await startQrCamera();
            } catch (error) {
                showFlash(error.message, 'error');
                document.getElementById('qrCameraStatus').textContent = error.message;
            }
        });
        document.getElementById('iImageFile').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
            if (!file) return;
            try {
                await uploadItemImage(file);
            } catch (error) {
                showFlash(error.message, 'error');
            }
        });
        document.getElementById('clearImageBtn').addEventListener('click', () => {
            document.getElementById('iImageUrl').value = '';
            document.getElementById('iImageFile').value = '';
            renderImagePreview('');
        });

        ['iType', 'iCategory', 'iSize', 'iVariantColor'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                if (editingItemId > 0) return;
                const skuEl = document.getElementById('iSku');
                if (!skuEl || skuEl.value.trim() !== '') return;
                const type    = document.getElementById('iType').value.trim();
                if (!type) return;
                skuEl.value = buildItemCodeFromFields(type);
            });
        });

        searchInput.addEventListener('input', renderTable);
        if (typeFilter) typeFilter.addEventListener('change', renderTable);
        categoryFilter.addEventListener('change', renderTable);
        stockFilter.addEventListener('change', renderTable);

        document.addEventListener('mousemove', (e) => {
            const target = e.target.closest('.item-thumb');
            if (!target) {
                hideImageHoverPreview();
                return;
            }
            const src = target.getAttribute('src') || '';
            showImageHoverPreview(src, e.clientX, e.clientY);
        });

        document.addEventListener('scroll', hideImageHoverPreview, true);
        window.addEventListener('resize', hideImageHoverPreview);

        document.getElementById('itemModal').addEventListener('click', (e) => {
            if (e.target.id === 'itemModal') closeItemModal();
        });
        document.getElementById('stockModal').addEventListener('click', (e) => {
            if (e.target.id === 'stockModal') closeStockModal();
        });
        document.getElementById('qrItemModal').addEventListener('click', (e) => {
            if (e.target.id === 'qrItemModal') closeQrItemModal();
        });

        window.editItem = editItem;
        window.openQrItemModal = openQrItemModal;
        window.openStockMove = openStockMove;
        window.updateQrCartQty = updateQrCartQty;
        window.removeQrCartItem = removeQrCartItem;
        window.setTableSort = setTableSort;
        window.switchPanel = switchPanel;

        (async function init() {
            const user = guardRole();
            if (!user) return;

                const dateEl = document.getElementById('topbarDate');
                if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ms-MY', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
            renderImagePreview('');
            renderQrCart();

            try {
                await fetchInventory();
            } catch (error) {
                showFlash(error.message, 'error');
                    tableWrap.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">${escapeHtml(error.message)}</div></div>`;
            }
        })();
    </script>
</body>
</html>