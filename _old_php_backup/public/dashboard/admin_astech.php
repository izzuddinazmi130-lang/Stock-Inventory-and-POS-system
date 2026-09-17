<?php
// public/dashboard/admin_astech.php - Astech Hardware Inventory
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/sessionManager.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/RolePermissions.php';
require_once __DIR__ . '/../../includes/paths.php';

SessionManager::start();

// Strict Role Check - Allow admin_astech and super_admin
if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], ['admin_astech', 'super_admin'])) {
    header('Location: ' . app_url('login.php'));
    exit;
}

$user = SessionManager::getUser();
$currentUserRole = $user['role'];
$currentUserName = $user['full_name'] ?? $user['name'] ?? 'Admin Astech';
$currentUserEmail = $user['email'] ?? 'astech@admin.com';
?>
﻿<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ASTECH KEDAI PC — Sistem Inventory</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>
        :root {
            --bg:       #05070d;
            --card:     rgba(12, 18, 32, 0.92);
            --line:     rgba(248, 113, 113, 0.26);
            --text:     #f8fafc;
            --muted:    #94a3b8;
            --primary:  #b91c1c;
            --gold:     #ef4444;
            --maroon:   #7f1d1d;
            --green:    #dc2626;
            --amber:    #991b1b;
            --shadow:   0 4px 24px rgba(0, 0, 0, 0.26);
            
            /* Friendly color accents */
            --cyan:     #06b6d4;
            --emerald:  #10b981;
            --purple:   #8b5cf6;
            --orange:   #f97316;
            --sky:      #0ea5e9;
            --pink:     #ec4899;
        }

        * { box-sizing: border-box; }

        /* ── friendly tech background ── */
        body {
            margin: 0;
            font-family: 'Rajdhani', sans-serif;
            font-size: 15px;
            color: var(--text);
            min-height: 100vh;
            background-color: var(--bg);
            background:
                radial-gradient(920px 500px at -8% -10%, rgba(248, 113, 113, 0.20), transparent 62%),
                radial-gradient(760px 420px at 110% -18%, rgba(239, 68, 68, 0.18), transparent 60%),
                radial-gradient(880px 520px at 52% 118%, rgba(59, 130, 246, 0.14), transparent 62%),
                linear-gradient(145deg, #111827 0%, #0f172a 45%, #111827 100%);
        }

        body::before {
            display: none;
        }

        body::after {
            content: '';
            position: fixed;
            inset: 0;
            background:
                radial-gradient(340px 180px at 22% 20%, rgba(255, 255, 255, 0.10), transparent 72%),
                radial-gradient(420px 220px at 82% 72%, rgba(248, 113, 113, 0.11), transparent 76%);
            filter: blur(4px);
            pointer-events: none;
            z-index: 0;
        }

        body { display: flex; min-height: 100vh; }

        body.light-mode {
            --bg: #f4f7fb;
            --card: rgba(255, 255, 255, 0.95);
            --line: rgba(220, 38, 38, 0.30);
            --text: #0f172a;
            --muted: #475569;
            --primary: #b91c1c;
            --gold: #ef4444;
            --maroon: #991b1b;
            --green: #047857;
            --amber: #b45309;
        }

        body.light-mode {
            background:
                radial-gradient(900px 480px at -8% -10%, rgba(248, 113, 113, 0.16), transparent 62%),
                radial-gradient(760px 420px at 110% -18%, rgba(239, 68, 68, 0.12), transparent 60%),
                radial-gradient(880px 520px at 52% 118%, rgba(59, 130, 246, 0.10), transparent 62%),
                linear-gradient(145deg, #f8fafc 0%, #eef2ff 45%, #f1f5f9 100%);
        }

        body.light-mode::before {
            display: none;
        }

        

        /* ════════════════════════════════════
           SIDEBAR
        ════════════════════════════════════ */
        .sidebar {
            width: 240px;
            flex-shrink: 0;
            background: linear-gradient(180deg, #0a0a0a 0%, #121212 38%, #1a1a1a 72%, #111111 100%);
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
            display: none;
        }

        /* ── sidebar brand ── */
        .sb-brand {
            padding: 28px 16px 22px;
            text-align: center;
            border-bottom: 1px solid rgba(239,68,68,0.18);
            position: relative;
            flex-shrink: 0;
            background: linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 100%);
        }
        .sb-logo {
            width: 96px;
            height: 96px;
            object-fit: contain;
            filter: drop-shadow(0 4px 16px rgba(239,68,68,0.40));
            display: block;
            margin: 0 auto 12px;
            transition: transform 0.3s ease;
        }
        .sb-logo:hover { transform: scale(1.05); }
        .sb-brand h2 {
            margin: 0;
            font-family: 'Orbitron', sans-serif;
            font-size: 18px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            background: linear-gradient(135deg, #ffffff 15%, #ef4444 55%, #ffffff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.2;
        }
        .sb-brand .sb-excl {
            display: inline-block;
            font-family: 'Rajdhani', sans-serif;
            font-style: normal;
            font-size: 10px;
            letter-spacing: 0.36em;
            color: rgba(248, 113, 113, 0.72);
            text-transform: uppercase;
            margin-top: 4px;
            border-top: 1px solid rgba(239,68,68,0.22);
            border-bottom: 1px solid rgba(239,68,68,0.22);
            padding: 2px 8px;
        }
        .sb-store {
            margin-top: 10px;
            font-size: 11px;
            color: rgba(255,255,255,0.72);
            letter-spacing: 0.08em;
            background: rgba(255,255,255,0.04);
            border-radius: 999px;
            padding: 3px 10px;
            display: inline-block;
        }

        /* ── sidebar nav ── */
        .sb-nav {
            flex: 1;
            padding: 12px 10px;
            position: relative;
        }

        .sb-section-label {
            padding: 14px 8px 7px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(254, 202, 202, 0.78);
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .sb-section-label::after {
            content: '';
            flex: 1;
            height: 1px;
            background: rgba(248,113,113,0.26);
        }

        .sb-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 11px 13px;
            margin-bottom: 6px;
            cursor: pointer;
            border: 1px solid rgba(248,113,113,0.14);
            background: rgba(255,255,255,0.04);
            width: 100%;
            text-align: left;
            color: rgba(255, 255, 255, 0.90);
            font-family: 'Rajdhani', sans-serif;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.02em;
            transition: all 0.2s ease;
            border-radius: 14px;
            position: relative;
        }
        .sb-item:hover {
            background: rgba(248,113,113,0.20);
            border-color: rgba(248,113,113,0.30);
            color: rgba(255,255,255,1);
            transform: translateX(3px);
        }
        .sb-item.active {
            background: linear-gradient(135deg, rgba(248,113,113,0.34), rgba(185,28,28,0.30));
            color: #ffffff;
            font-weight: 700;
            border-color: rgba(252, 165, 165, 0.65);
            box-shadow: 0 8px 18px rgba(127,29,29,0.32), inset 0 0 0 1px rgba(254,202,202,0.48);
        }
        .sb-item.active .sb-icon { transform: scale(1.15); }
        .sb-item .sb-icon {
            font-size: 17px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: rgba(255,255,255,0.12);
            flex-shrink: 0;
            transition: transform 0.18s;
        }

        /* ── sidebar footer ── */
        .sb-footer {
            padding: 14px 12px;
            border-top: 1px solid rgba(239,68,68,0.18);
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
            border: 1px solid rgba(239,68,68,0.18);
        }
        .sb-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ef4444, #991b1b);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            flex-shrink: 0;
            border: 1.5px solid rgba(248,113,113,0.42);
        }
        .sb-user {
            font-size: 12px;
            color: rgba(255,255,255,0.86);
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
            border: 1px solid rgba(239,68,68,0.36);
            border-radius: 12px;
            background: rgba(127,29,29,0.26);
            color: rgba(254,226,226,0.92);
            font-family: 'Rajdhani', sans-serif;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.18s;
            letter-spacing: 0.04em;
        }
        .sb-logout:hover { background: rgba(220,38,38,0.30); color: #ffffff; border-color: rgba(248,113,113,0.58); }

        /* ════════════════════════════════════
           MAIN AREA
        ════════════════════════════════════ */
        .main-area {
            flex: 1;
            margin-left: 240px;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            position: relative;
            z-index: 2;
        }

        /* ── thin topbar ── */
        .topbar {
            height: 64px;
            background: var(--card);
            border-bottom: 1px solid var(--line);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 26px;
            gap: 12px;
            position: sticky;
            top: 0;
            z-index: 50;
            box-shadow: 0 1px 14px rgba(17,17,17,0.12);
        }
        .topbar-left { display: flex; flex-direction: column; justify-content: center; }
        .topbar-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 17px;
            color: #fecaca;
            font-weight: 700;
            letter-spacing: 0.03em;
            line-height: 1.2;
        }
        .topbar-date { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; margin-top: 1px; }

        /* ── page content ── */
        .page-content { 
            flex: 1; 
            padding: 28px 28px 40px;
            background: linear-gradient(180deg, transparent 0%, rgba(16,185,129,0.04) 100%);
        }

        /* ── tab panels ── */
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }

        /* ── wrap for inner max-width ── */
        .inner { max-width: 1140px; }

        .chip {
            border: 1px solid rgba(239,68,68,0.28);
            background: rgba(239,68,68,0.10);
            color: #fecaca;
            border-radius: 999px;
            padding: 5px 14px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
        }

        .btn {
            border: 1px solid transparent;
            border-radius: 14px;
            padding: 10px 20px;
            font: inherit;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.22s ease;
            letter-spacing: 0.03em;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .btn:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 6px 16px rgba(0,0,0,0.18); 
        }
        .btn:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.12); }

        .btn-main {
            background: linear-gradient(135deg, #ef4444 0%, #b91c1c 50%, #7f1d1d 100%);
            color: #fff;
            box-shadow: 0 4px 12px rgba(185,28,28,0.36);
        }
        .btn-main:hover { 
            box-shadow: 0 8px 20px rgba(185,28,28,0.48);
            background: linear-gradient(135deg, #f87171 0%, #dc2626 50%, #991b1b 100%);
        }

        .btn-ghost {
            border-color: var(--line);
            background: rgba(255,255,255,0.06);
            color: #fecaca;
        }
        .btn-ghost:hover { 
            background: rgba(239,68,68,0.12); 
            border-color: rgba(248,113,113,0.45);
        }

        .btn-success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #fff;
            box-shadow: 0 4px 12px rgba(16,185,129,0.32);
        }
        .btn-success:hover { 
            box-shadow: 0 8px 20px rgba(16,185,129,0.40);
            background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
        }

        .btn-danger {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: #fff;
            box-shadow: 0 4px 12px rgba(220,38,38,0.32);
        }
        .btn-danger:hover {
            box-shadow: 0 8px 20px rgba(220,38,38,0.40);
            background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
        }

        /* inner buttons (table rows, modals — on light bg) */
        .btn-inner-ghost {
            border: 1px solid rgba(248, 113, 113, 0.22);
            background: rgba(255,255,255,0.04);
            color: #fecaca;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            border-radius: 10px;
            padding: 6px 13px;
            cursor: pointer;
            transition: all 0.18s;
        }
        .btn-inner-ghost:hover { 
            background: rgba(248,113,113,0.10);
            border-color: rgba(248, 113, 113, 0.36);
            transform: translateY(-1px);
        }

        .btn-inner-green {
            border: 1px solid rgba(16,185,129,0.28);
            background: rgba(16,185,129,0.10);
            color: #10b981;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            border-radius: 10px;
            padding: 6px 13px;
            cursor: pointer;
            transition: all 0.18s;
        }
        .btn-inner-green:hover { 
            background: rgba(16,185,129,0.18);
            border-color: rgba(16,185,129,0.42);
            transform: translateY(-1px);
        }

        .btn-inner-red {
            border: 1px solid rgba(239,68,68,0.28);
            background: rgba(239,68,68,0.10);
            color: #ef4444;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            border-radius: 10px;
            padding: 6px 13px;
            cursor: pointer;
            transition: all 0.18s;
        }
        .btn-inner-red:hover { 
            background: rgba(239,68,68,0.18);
            border-color: rgba(239,68,68,0.42);
            transform: translateY(-1px);
        }

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
        .flash.success { background: rgba(15, 23, 42, 0.45); border-color: rgba(185,28,28,0.22); color: #fecaca; }
        .flash.error   { background: #fdf2f2; border-color: rgba(160,40,40,0.22); color: #8b2020; }

        /* ── stats ── */
        .stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .stat {
            background: var(--card);
            border: 1px solid rgba(248, 113, 113, 0.18);
            border-radius: 22px;
            padding: 22px 20px 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.08);
            position: relative;
            overflow: hidden;
            transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s, border-color 0.22s;
        }
        .stat:hover { 
            transform: translateY(-4px); 
            box-shadow: 0 12px 28px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.12);
            border-color: rgba(248, 113, 113, 0.32);
        }
        .stat::before {
            content: '';
            position: absolute;
            top: 0; left: 0; bottom: 0;
            width: 5px;
            background: linear-gradient(180deg, var(--gold), rgba(239,68,68,0.20));
            border-radius: 22px 0 0 22px;
        }
        .stat.stat-low::before { background: linear-gradient(180deg, var(--amber), rgba(153,27,27,0.20)); }
        .stat.stat-out::before { background: linear-gradient(180deg, var(--maroon), rgba(107,32,32,0.16)); }
        
        .stat .icon {
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06));
            border: 1px solid rgba(248, 113, 113, 0.20);
            border-radius: 14px;
            margin-bottom: 12px;
            transition: all 0.22s;
        }
        .stat:hover .icon {
            background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.10));
            border-color: rgba(248, 113, 113, 0.32);
            transform: scale(1.08);
        }
        
        .stat.stat-low .icon { 
            background: linear-gradient(135deg, rgba(153,27,27,0.12), rgba(153,27,27,0.06));
            border-color: rgba(153,27,27,0.22);
        }
        .stat.stat-out .icon { 
            background: linear-gradient(135deg, rgba(107,32,32,0.10), rgba(107,32,32,0.05));
            border-color: rgba(107,32,32,0.16);
        }
        
        .stat .label { 
            color: var(--muted); 
            font-size: 11px; 
            text-transform: uppercase; 
            letter-spacing: 0.11em; 
            font-weight: 700;
            margin-bottom: 8px;
        }
        .stat .value {
            margin-top: 6px;
            font-family: 'Orbitron', sans-serif;
            font-size: 38px;
            font-weight: 700;
            color: #fecaca;
            line-height: 1;
        }
        .stat.stat-low .value { color: var(--amber); }
        .stat.stat-out .value { color: var(--maroon); }

        /* ── panel ── */
        .panel {
            background: var(--card);
            border: 1px solid rgba(248, 113, 113, 0.18);
            border-radius: 22px;
            padding: 26px 28px;
            margin-bottom: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.08);
            transition: box-shadow 0.22s, border-color 0.22s;
        }
        .panel:hover {
            box-shadow: 0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.10);
            border-color: rgba(248, 113, 113, 0.28);
        }

        .panel h2 {
            margin: 0 0 18px;
            font-family: 'Orbitron', sans-serif;
            font-size: 18px;
            color: #fecaca;
            letter-spacing: 0.03em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .panel h2::before {
            content: '';
            display: inline-block;
            width: 5px;
            height: 22px;
            background: linear-gradient(180deg, var(--gold), rgba(239,68,68,0.20));
            border-radius: 4px;
            flex-shrink: 0;
        }

        .panel-head {
            display: flex;
            justify-content: space-between;
            gap: 14px;
            align-items: center;
            margin-bottom: 18px;
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

        .inventory-subnav {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }

        .inventory-subnav-btn {
            border: 1px solid rgba(248,113,113,0.24);
            background: rgba(255,255,255,0.06);
            color: var(--text);
            border-radius: 999px;
            padding: 6px 12px;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.18s ease;
        }

        .inventory-subnav-btn:hover {
            background: rgba(239,68,68,0.14);
            border-color: rgba(248,113,113,0.40);
        }

        .inventory-subnav-btn.active {
            background: linear-gradient(135deg, rgba(239,68,68,0.32), rgba(185,28,28,0.26));
            border-color: rgba(252,165,165,0.64);
            color: #ffffff;
            box-shadow: 0 6px 14px rgba(127,29,29,0.24);
        }

        .sortable-th {
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }

        .sortable-th:hover {
            color: #fecaca;
        }

        .input,
        .select {
            width: 100%;
            border: 1.5px solid rgba(248, 113, 113, 0.22);
            border-radius: 14px;
            padding: 12px 14px;
            font: inherit;
            font-family: 'Rajdhani', sans-serif;
            font-size: 14px;
            color: #f8fafc;
            background: rgba(255,255,255,0.05);
            transition: border-color 0.22s, box-shadow 0.22s, background 0.22s;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            cursor: pointer;
        }
        .select {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23fecaca' d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-color: rgba(255,255,255,0.05);
            padding-right: 36px;
        }
        .input::placeholder {
            color: rgba(248, 113, 113, 0.60);
        }
        .select > option {
            background: #1a1a2e;
            color: #fecaca;
            padding: 8px 10px;
        }
        .select > option:hover {
            background: rgba(239, 68, 68, 0.30);
        }
        .select > option:checked {
            background: linear-gradient(135deg, rgba(239,68,68,0.40), rgba(185,28,28,0.30));
            color: #fecaca;
        }
        .input:focus, 
        .select:focus {
            outline: none;
            border-color: #ef4444;
            box-shadow: 0 0 0 4px rgba(239,68,68,0.15), 0 4px 12px rgba(239,68,68,0.12);
            background: rgba(255,255,255,0.08);
        }

        /* ── table ── */
        .table-wrap {
            border: 1px solid rgba(248, 113, 113, 0.16);
            border-radius: 16px;
            overflow: auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        table { width: 100%; border-collapse: collapse; min-width: 940px; }
        thead { background: rgba(16,185,129,0.06); }
        th {
            padding: 14px 14px;
            color: rgba(248, 113, 113, 0.88);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.11em;
            font-weight: 700;
            border-bottom: 1.5px solid rgba(248, 113, 113, 0.16);
            text-align: left;
        }
        td {
            padding: 12px 14px;
            border-bottom: 1px solid rgba(248, 113, 113, 0.10);
            font-size: 14px;
            vertical-align: middle;
        }
        .cell-main {
            font-weight: 700;
            color: var(--text);
            line-height: 1.4;
        }
        .cell-sub {
            margin-top: 4px;
            font-size: 12px;
            color: rgba(148, 163, 184, 0.80);
            line-height: 1.45;
        }
        .item-thumb {
            width: 52px;
            height: 52px;
            border-radius: 12px;
            object-fit: cover;
            border: 1px solid rgba(248, 113, 113, 0.16);
            background: rgba(255,255,255,0.02);
            display: block;
            cursor: zoom-in;
            transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .item-thumb:hover {
            transform: scale(1.08);
            box-shadow: 0 4px 12px rgba(249,115,22,0.20);
        }

        .image-hover-preview {
            position: fixed;
            width: 230px;
            height: 230px;
            border-radius: 14px;
            border: 1px solid rgba(185,28,28,0.28);
            box-shadow: 0 16px 34px rgba(17,17,17,0.26);
            background: var(--card);
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
            border: 1px dashed rgba(185,28,28,0.35);
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
        tbody tr:hover { background: rgba(15, 23, 42, 0.45); }

        /* ── status pills ── */
        .status-pill {
            display: inline-block;
            border-radius: 999px;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.04em;
        }
        .pill-ok  { background: rgba(17,17,17,0.06);  color: #f8fafc; border: 1px solid rgba(17,17,17,0.18); }
        .pill-low { background: rgba(239,68,68,0.12);  color: #b91c1c; border: 1px solid rgba(185,28,28,0.30); }
        .pill-out { background: rgba(107,32,32,0.12);  color: #6b2020; border: 1px solid rgba(107,32,32,0.25); }

        .row-actions { display: flex; gap: 6px; flex-wrap: wrap; }

        .qr-shell {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 16px;
        }

        .qr-card {
            border: 1px solid rgba(185,28,28,0.35);
            border-radius: 22px;
            background: rgba(17,17,17,0.06);
            padding: 24px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.10);
            transition: box-shadow 0.22s, border-color 0.22s;
        }
        .qr-card:hover {
            box-shadow: 0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.12);
            border-color: rgba(248, 113, 113, 0.28);
        }

        .qr-card h3 {
            margin: 0 0 12px;
            font-family: 'Orbitron', sans-serif;
            font-size: 20px;
            color: #fecaca;
            letter-spacing: 0.03em;
        }

        .qr-lead {
            margin: 0 0 18px;
            color: rgba(148, 163, 184, 0.88);
            font-size: 14px;
            line-height: 1.8;
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
            border: 1.5px solid rgba(248, 113, 113, 0.20);
            background: rgba(255,255,255,0.04);
            color: #fecaca;
            border-radius: 12px;
            padding: 10px 16px;
            font: inherit;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.22s;
            letter-spacing: 0.03em;
        }
        .qr-mode-btn:hover {
            background: rgba(248,113,113,0.08);
            border-color: rgba(248,113,113,0.32);
        }

        .qr-mode-btn.active.stock-in {
            background: linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.10));
            color: #10b981;
            border-color: rgba(16,185,129,0.36);
            box-shadow: 0 4px 12px rgba(16,185,129,0.16);
        }

        .qr-mode-btn.active.stock-out {
            background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.10));
            color: #ef4444;
            border-color: rgba(239,68,68,0.36);
            box-shadow: 0 4px 12px rgba(239,68,68,0.16);
        }

        .qr-camera-box {
            margin-top: 18px;
            border: 1.5px solid rgba(248, 113, 113, 0.18);
            border-radius: 18px;
            background: rgba(255,255,255,0.03);
            padding: 16px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
            transition: border-color 0.22s, box-shadow 0.22s;
        }
        .qr-camera-box:hover {
            border-color: rgba(248, 113, 113, 0.28);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 8px rgba(0,0,0,0.06);
        }

        .qr-video {
            width: 100%;
            max-height: 280px;
            border-radius: 14px;
            background: #0b1220;
            display: none;
            object-fit: cover;
            border: 1px solid rgba(248, 113, 113, 0.15);
        }

        .qr-video.active { display: block; }

        .qr-camera-empty {
            border-radius: 14px;
            padding: 36px 20px;
            text-align: center;
            color: var(--muted);
            background: rgba(255, 255, 255, 0.02);
            border: 1px dashed rgba(248, 113, 113, 0.20);
        }

        .qr-summary {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            margin-bottom: 14px;
            color: rgba(148, 163, 184, 0.88);
            font-size: 13px;
            flex-wrap: wrap;
            background: rgba(255,255,255,0.02);
            border-radius: 12px;
            padding: 12px;
            border: 1px solid rgba(248, 113, 113, 0.10);
        }

        .qr-cart-list {
            display: grid;
            gap: 11px;
            margin-bottom: 14px;
        }

        .qr-cart-item {
            border: 1px solid rgba(248, 113, 113, 0.16);
            border-radius: 16px;
            background: rgba(255,255,255,0.04);
            padding: 14px;
            display: grid;
            grid-template-columns: 64px 1fr auto;
            gap: 14px;
            align-items: center;
            transition: all 0.22s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .qr-cart-item:hover {
            background: rgba(255,255,255,0.06);
            border-color: rgba(248, 113, 113, 0.28);
            box-shadow: 0 4px 12px rgba(0,0,0,0.10);
        }

        .qr-cart-title {
            margin: 0 0 5px;
            font-weight: 700;
            color: var(--text);
            font-size: 14px;
        }

        .qr-cart-meta {
            font-size: 12px;
            color: rgba(148, 163, 184, 0.80);
            line-height: 1.6;
        }

        .qr-qty-box {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .qr-qty-input {
            width: 82px;
            text-align: center;
            padding: 8px 10px;
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
        .empty-text { font-size: 14px; font-style: normal; }

        /* ── modal overlay ── */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.72);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999;
            padding: 24px;
            animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; backdrop-filter: blur(0); }
            to { opacity: 1; backdrop-filter: blur(8px); }
        }
        .modal-overlay.hidden { display: none; }

        .modal-box {
            background: var(--card);
            border: 1px solid rgba(248, 113, 113, 0.18);
            border-radius: 26px;
            width: 100%;
            max-width: 560px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 32px;
            position: relative;
            box-shadow: 0 24px 72px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08);
            animation: slideUp 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .modal-deco {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 5px;
            background: linear-gradient(90deg, #10b981, var(--gold), #0ea5e9, var(--gold), #10b981);
            background-size: 200% 100%;
            border-radius: 26px 26px 0 0;
            animation: gradientShift 8s ease infinite;
        }
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        .modal-title {
            margin: 8px 0 20px;
            font-family: 'Orbitron', sans-serif;
            font-size: 20px;
            color: #fecaca;
            letter-spacing: 0.04em;
        }

        .image-upload-box {
            border: 1.5px dashed rgba(248, 113, 113, 0.24);
            border-radius: 16px;
            background: rgba(255,255,255,0.03);
            padding: 16px;
            transition: all 0.22s;
        }
        .image-upload-box:hover {
            border-color: rgba(248, 113, 113, 0.36);
            background: rgba(255,255,255,0.05);
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
            border: 1px solid rgba(17,17,17,0.16);
            background: var(--card);
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
            font-family: 'Orbitron', sans-serif;
            color: #fecaca;
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
            background: var(--card);
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

        .form-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 14px;
            margin-bottom: 2px;
        }
        .pc-specs-grid,
        .component-specs-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 14px;
        }
        .pc-specs-grid.hidden { display: none; }
        .component-specs-wrap {
            border: 1px solid rgba(248, 113, 113, 0.16);
            border-radius: 18px;
            background: linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02));
            padding: 18px;
            margin-bottom: 14px;
            transition: all 0.22s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .component-specs-wrap:hover {
            border-color: rgba(16,185,129,0.28);
            background: linear-gradient(135deg, rgba(16,185,129,0.10), rgba(16,185,129,0.04));
            box-shadow: 0 4px 12px rgba(16,185,129,0.12);
        }
        .component-specs-wrap.hidden { display: none; }
        
        .component-specs-head {
            margin-bottom: 14px;
        }
        .component-specs-title {
            margin: 0 0 6px;
            font-family: 'Orbitron', sans-serif;
            font-size: 15px;
            color: #10b981;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .component-specs-sub {
            margin: 0;
            color: rgba(148, 163, 184, 0.80);
            font-size: 12px;
            line-height: 1.6;
        }
        .component-specs-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }
        .component-specs-grid.hidden { display: none; }
        
        .type-hint {
            margin: 4px 0 14px;
            padding: 10px 14px;
            font-size: 13px;
            color: #10b981;
            font-weight: 600;
            letter-spacing: 0.02em;
            background: rgba(16,185,129,0.10);
            border: 1px solid rgba(16,185,129,0.22);
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .type-hint::before {
            content: '→';
            font-weight: 700;
            animation: slideRight 0.6s ease infinite;
        }
        @keyframes slideRight {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(4px); }
        }
        .field { margin-bottom: 12px; }
        .field label {
            display: block;
            margin-bottom: 8px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.11em;
            color: rgba(248, 113, 113, 0.78);
            font-weight: 700;
            transition: color 0.22s;
        }
        .field:focus-within label {
            color: #fecaca;
        }

        .modal-actions {
            margin-top: 24px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        .modal-actions .btn { 
            border-radius: 12px;
            padding: 10px 22px;
        }
        .modal-actions .btn-main { 
            background: linear-gradient(135deg, #10b981, #059669);
            color: #fff;
            box-shadow: 0 4px 12px rgba(16,185,129,0.28);
        }
        .modal-actions .btn-main:hover {
            background: linear-gradient(135deg, #34d399, #10b981);
            box-shadow: 0 8px 20px rgba(16,185,129,0.36);
        }
        .modal-actions .btn-ghost { 
            border-color: rgba(248, 113, 113, 0.22);
            background: rgba(255,255,255,0.04);
            color: #fecaca;
        }
        .modal-actions .btn-ghost:hover {
            background: rgba(248,113,113,0.10);
            border-color: rgba(248, 113, 113, 0.36);
        }
        .modal-actions .btn-success { 
            background: linear-gradient(135deg, #10b981, #059669);
            color: #fff;
            box-shadow: 0 4px 12px rgba(16,185,129,0.28);
        }
        .modal-actions .btn-success:hover {
            background: linear-gradient(135deg, #34d399, #10b981);
            box-shadow: 0 8px 20px rgba(16,185,129,0.36);
        }

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
            background: rgba(255,255,255,0.05);
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
            background: rgba(255,255,255,0.04);
            color: var(--text);
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
            border: 1px solid rgba(248, 113, 113, 0.16);
            border-radius: 18px;
            background: rgba(255,255,255,0.04);
            padding: 18px;
            transition: all 0.22s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .detail-card:hover {
            background: rgba(255,255,255,0.06);
            border-color: rgba(248, 113, 113, 0.28);
            box-shadow: 0 4px 12px rgba(0,0,0,0.10);
        }
        
        .detail-card h4 {
            margin: 0 0 14px;
            font-family: 'Orbitron', sans-serif;
            font-size: 15px;
            color: #10b981;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .detail-list {
            display: grid;
            gap: 12px;
        }
        .detail-row {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 12px;
            align-items: start;
        }
        .detail-label {
            color: rgba(248, 113, 113, 0.72);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.10em;
            font-weight: 700;
        }
        .detail-value {
            color: var(--text);
            font-size: 14px;
            font-weight: 600;
            line-height: 1.5;
            word-break: break-word;
        }

        /* ── scrollbar ── */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(185,28,28,0.32); border-radius: 99px; }

        /* ── responsive ── */
        @media (max-width: 900px) {
            .sidebar { width: 200px; }
            .main-area { margin-left: 200px; }
        }
        /* ── analytics ── */
        .analytics-bar-wrap { display: grid; gap: 10px; }
        .analytics-bar-row { display: grid; grid-template-columns: 130px 1fr 80px; gap: 8px; align-items: center; font-size: 13px; }
        .analytics-bar-label { color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .analytics-bar-track { height: 10px; background: rgba(239,68,68,0.12); border-radius: 999px; overflow: hidden; }
        .analytics-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold), var(--primary)); transition: width 0.4s ease; }
        .analytics-bar-fill.green { background: linear-gradient(90deg, #ef4444, #b91c1c); }
        .analytics-bar-fill.red { background: linear-gradient(90deg, #a03030, #c03838); }
        .analytics-bar-val { text-align: right; color: var(--muted); font-size: 12px; font-weight: 700; }
        .analytics-move-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .analytics-move-card { border: 1px solid var(--line); border-radius: 14px; padding: 14px 12px; text-align: center; background: var(--card); }
        .analytics-move-card .move-icon { font-size: 22px; margin-bottom: 6px; }
        .analytics-move-card .move-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted); font-weight: 700; }
        .analytics-move-card .move-val { font-family: 'Orbitron', sans-serif; font-size: 26px; font-weight: 700; color: #fecaca; line-height: 1.1; margin: 4px 0 2px; }
        .analytics-move-card .move-sub { font-size: 12px; color: var(--muted); }
        .analytics-rd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .analytics-rd-card { border-radius: 16px; padding: 18px 16px; text-align: center; }
        .analytics-rd-card.return-card { background: rgba(17,17,17,0.05); border: 1px solid rgba(17,17,17,0.16); }
        .analytics-rd-card.damage-card { background: rgba(107,32,32,0.07); border: 1px solid rgba(107,32,32,0.18); }
        .analytics-rd-icon { font-size: 28px; margin-bottom: 8px; }
        .analytics-rd-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em; font-weight: 700; margin-bottom: 6px; }
        .analytics-rd-card.return-card .analytics-rd-label { color: var(--text); }
        .analytics-rd-card.damage-card .analytics-rd-label { color: var(--maroon); }
        .analytics-rd-val { font-family: 'Orbitron', sans-serif; font-size: 30px; font-weight: 700; line-height: 1; }
        .analytics-rd-card.return-card .analytics-rd-val { color: var(--text); }
        .analytics-rd-card.damage-card .analytics-rd-val { color: var(--maroon); }
        .analytics-rd-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
        .top-item-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(17,17,17,0.08); }
        .top-item-row:last-child { border-bottom: none; }
        .top-item-rank { width: 24px; height: 24px; border-radius: 50%; background: rgba(239,68,68,0.12); color: #fecaca; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .top-item-info { flex: 1; min-width: 0; }
        .top-item-code { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .top-item-meta { font-size: 11px; color: var(--muted); }
        .top-item-qty { font-size: 14px; font-weight: 700; color: #fecaca; white-space: nowrap; }

        /* ── light mode component overrides ── */
        body.light-mode .sidebar {
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 40%, #eef2ff 100%);
            border-right: 1px solid rgba(220, 38, 38, 0.18);
        }
        body.light-mode .sidebar::before {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M24 2L46 24L24 46L2 24Z' fill='none' stroke='rgba(220,38,38,0.07)' stroke-width='1'/%3E%3C/svg%3E");
        }
        body.light-mode .sb-brand {
            background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.72) 100%);
        }
        body.light-mode .sb-brand h2 {
            background: linear-gradient(135deg, #111827 8%, #dc2626 52%, #111827 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: none;
        }
        body.light-mode .sb-brand .sb-excl {
            color: #b91c1c;
            border-top-color: rgba(185, 28, 28, 0.28);
            border-bottom-color: rgba(185, 28, 28, 0.28);
            background: rgba(255, 255, 255, 0.58);
        }
        body.light-mode .sb-store,
        body.light-mode .sb-user {
            color: #1f2937;
        }
        body.light-mode .sb-store {
            background: rgba(220, 38, 38, 0.08);
            border: 1px solid rgba(220, 38, 38, 0.16);
        }
        body.light-mode .sb-section-label {
            color: #991b1b;
        }
        body.light-mode .sb-section-label::after {
            background: rgba(185, 28, 28, 0.22);
        }
        body.light-mode .sb-footer {
            border-top-color: rgba(185, 28, 28, 0.18);
        }
        body.light-mode .sb-avatar-row {
            background: rgba(255,255,255,0.62);
            border-color: rgba(220, 38, 38, 0.18);
        }
        body.light-mode .sb-logout {
            color: #7f1d1d;
            background: rgba(220, 38, 38, 0.10);
            border-color: rgba(220, 38, 38, 0.22);
        }
        body.light-mode .sb-logout:hover {
            color: #ffffff;
            background: rgba(220, 38, 38, 0.84);
            border-color: rgba(185, 28, 28, 0.42);
        }
        body.light-mode .topbar-date,
        body.light-mode .field label,
        body.light-mode .component-specs-sub,
        body.light-mode .type-hint,
        body.light-mode .detail-label,
        body.light-mode .upload-status,
        body.light-mode .image-upload-note {
            color: #334155;
        }
        body.light-mode .component-specs-title,
        body.light-mode .detail-card h4,
        body.light-mode .detail-name,
        body.light-mode .cell-main {
            color: #111827;
        }
        body.light-mode .cell-sub,
        body.light-mode .detail-description,
        body.light-mode .detail-value {
            color: #475569;
        }
        body.light-mode .component-specs-wrap,
        body.light-mode .detail-card {
            background: rgba(255,255,255,0.72);
        }
        body.light-mode .sb-item {
            background: rgba(15, 23, 42, 0.03);
            border-color: rgba(220, 38, 38, 0.16);
            color: #1f2937;
        }
        body.light-mode .sb-item:hover {
            background: rgba(220, 38, 38, 0.10);
            border-color: rgba(220, 38, 38, 0.24);
            color: #111827;
        }
        body.light-mode .sb-item.active {
            background: linear-gradient(135deg, rgba(220, 38, 38, 0.22), rgba(254, 202, 202, 0.45));
            color: #7f1d1d;
            border-color: rgba(220, 38, 38, 0.34);
            box-shadow: 0 8px 18px rgba(220, 38, 38, 0.16), inset 0 0 0 1px rgba(254, 202, 202, 0.6);
        }
        body.light-mode .sb-item .sb-icon {
            background: rgba(220, 38, 38, 0.09);
        }
        body.light-mode .topbar-title,
        body.light-mode .panel h2,
        body.light-mode .qr-card h3,
        body.light-mode .modal-title,
        body.light-mode .qr-item-title,
        body.light-mode .analytics-move-card .move-val,
        body.light-mode .top-item-rank,
        body.light-mode .top-item-qty {
            color: #b91c1c;
        }
        body.light-mode .chip {
            color: #b91c1c;
            background: rgba(220, 38, 38, 0.08);
        }
        body.light-mode .btn-ghost {
            color: #334155;
            background: rgba(15, 23, 42, 0.04);
        }
        body.light-mode .flash.success {
            background: #ecfdf5;
            border-color: rgba(16, 185, 129, 0.25);
            color: #065f46;
        }
        body.light-mode .flash.error {
            background: #fff1f2;
            border-color: rgba(220, 38, 38, 0.24);
            color: #9f1239;
        }

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
            .sb-nav { display: flex; flex-direction: row; overflow-x: auto; padding: 6px 6px 8px; width: 100%; border-top: 1px solid rgba(239,68,68,0.20); gap: 6px; scroll-snap-type: x proximity; }
            .sb-section-label { display: none; }
            .sb-item { white-space: nowrap; border-left: none; border-bottom: 3px solid transparent; padding: 9px 14px; font-size: 12px; margin-bottom: 0; scroll-snap-align: start; }
            .sb-item.active { border-left-color: transparent; border-bottom-color: #fecaca; }
            .sb-footer { width: 100%; display: flex; gap: 8px; align-items: center; padding: 8px 16px; }
            .sb-user { margin-bottom: 0; }
            .main-area { margin-left: 0; }
            .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .filters { grid-template-columns: 1fr; }
            .form-grid { grid-template-columns: 1fr; }
            .pc-specs-grid { grid-template-columns: 1fr; }
            .qr-shell { grid-template-columns: 1fr; }
            .detail-hero,
            .detail-sections,
            .detail-row { grid-template-columns: 1fr; }
            .detail-image { width: 100%; max-width: 220px; height: 180px; }
        }

        .sb-nav::-webkit-scrollbar { height: 5px; }
        .sb-nav::-webkit-scrollbar-thumb { background: rgba(248,113,113,0.28); border-radius: 999px; }
    </style>
</head>
<body>

    <!-- ══════════  SIDEBAR  ══════════ -->
    <link rel="icon" type="image/png" href="https://res.cloudinary.com/dd9grczp5/image/upload/v1770430109/images_1_xlb8fg.png">
    <aside class="sidebar">
        <div class="sb-brand">
            <img id="sbLogo" src="<?php echo htmlspecialchars(app_url("assets/logo_astech_techlegacy.png")); ?>" alt="ASTECH LEGACY Logo" class="sb-logo" onerror="this.onerror=null;this.src='<?php echo htmlspecialchars(app_url("assets/kaftanasia_logo.png")); ?>';">
            <h2>AS TECH LEGACY  </h2>
            <span class="sb-excl">PROCUREMENT</span>
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
                <div class="sb-user" id="sbUser">Stock Manager Astech</div>
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
                <span class="chip" id="userChip">Stock Manager Astech</span>
                <button class="btn btn-ghost" type="button" id="themeToggleBtn" style="font-size:12px;padding:6px 12px;">☀ Light</button>
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
                        <div class="label">Jumlah Stok</div>
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
                            Selamat datang ke <strong style="color:var(--primary);">Sistem Inventori ASTECH Kedai PC</strong>. 🌸<br>
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
                    <div class="inventory-subnav" id="inventorySubnav">
                        <button class="inventory-subnav-btn active" type="button" data-subnav="all" onclick="setInventorySubNav('all')">Semua</button>
                        <button class="inventory-subnav-btn" type="button" data-subnav="pc" onclick="setInventorySubNav('pc')">PC</button>
                        <button class="inventory-subnav-btn" type="button" data-subnav="component" onclick="setInventorySubNav('component')">Component</button>
                        <button class="inventory-subnav-btn" type="button" data-subnav="accesories" onclick="setInventorySubNav('accesories')">Accesories</button>
                    </div>
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
            <input id="iSku" type="hidden">
            <div class="form-grid">
                <div class="field"><label for="iType">Type</label>
                    <select id="iType" class="select">
                        <option value="">Pilih Type</option>
                        <option value="PC">PC</option>
                        <option value="Component">Component</option>
                        <option value="Accecories">Accecories</option>
                    </select>
                </div>
               
            </div>
            <p class="type-hint" id="itemTypeHint">Pilih Type dahulu untuk buka bahagian seterusnya.</p>
            <div id="itemFieldsAfterType" style="display:none;">
            <div class="form-grid">
                <div class="field">
                    <label for="iCategory">Category (Nama Produk)</label>
                    <select id="iCategory" class="select">
                        <option value="">Pilih Type dahulu</option>
                    </select>
                </div>
                <div class="field"><label for="iVariantColor">Variant (Warna)</label><input id="iVariantColor" class="input" type="text" placeholder="Contoh: Hitam"></div>
            </div>
            <div class="pc-specs-grid hidden" id="pcSpecsGrid">
                <div class="field"><label for="iPcBrand">Brand Laptop</label><input id="iPcBrand" class="input" type="text" placeholder="Contoh: ASUS"></div>
                <div class="field"><label for="iPcDeviceType">Type Laptop</label><input id="iPcDeviceType" class="input" type="text" placeholder="Contoh: Gaming / Ultrabook"></div>
                <div class="field"><label for="iPcModel">Model Laptop</label><input id="iPcModel" class="input" type="text" placeholder="Contoh: TUF F15"></div>
                <div class="field"><label for="iPanelType">Panel Type</label><input id="iPanelType" class="input" type="text" placeholder="Contoh: IPS"></div>
                <div class="field"><label for="iPortInterface">Port Interface</label><input id="iPortInterface" class="input" type="text" placeholder="Contoh: USB-C, HDMI, RJ45"></div>
                <div class="field"><label for="iScreenSize">Laptop Screen Size</label><input id="iScreenSize" class="input" type="text" placeholder="Contoh: 15.6 inch"></div>
                <div class="field"><label for="iGraphicsChipset">Graphic Chipset Manufacture</label><input id="iGraphicsChipset" class="input" type="text" placeholder="Contoh: NVIDIA RTX 4050"></div>
                <div class="field"><label for="iStorageCapacity">Storage Capacity</label><input id="iStorageCapacity" class="input" type="text" placeholder="Contoh: 512GB"></div>
                <div class="field"><label for="iStorageType">Storage Type</label><input id="iStorageType" class="input" type="text" placeholder="Contoh: NVMe SSD"></div>
                <div class="field"><label for="iProcessorType">Processor Type</label><input id="iProcessorType" class="input" type="text" placeholder="Contoh: Intel Core i7-13620H"></div>
            </div>
            <div class="component-specs-wrap hidden" id="componentSpecsWrap">
                <div class="component-specs-head">
                    <h4 class="component-specs-title" id="componentSpecsTitle">Component Specification</h4>
                    <p class="component-specs-sub" id="componentSpecsSub">Field akan berubah ikut jenis component seperti Battery atau GPU.</p>
                </div>
                <div class="component-specs-grid" id="componentSpecsGrid"></div>
            </div>
            <div class="form-grid">
                <div class="field"><label for="iName">Nama Item (Auto jika kosong)</label><input id="iName" class="input" type="text" placeholder="Contoh: GPU RTX 4060 Hitam"></div>
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
                <div class="field"><label for="iQty">Kuantiti Awal</label><input id="iQty" class="input" type="number" step="1" min="0" value="0"></div>
                <div class="field"><label for="iMinQty">Minimum Qty</label><input id="iMinQty" class="input" type="number" step="1" min="0" value="0"></div>
            </div>
            <div class="form-grid">
                <div class="field"><label for="iUnitPrice">Unit Price (RM)</label><input id="iUnitPrice" class="input" type="number" step="0.1" min="0" value="0"></div>
                <div class="field"><label for="iSellingPrice">Selling Price (RM)</label><input id="iSellingPrice" class="input" type="number" step="0.1" min="0" value="0"></div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" type="button" id="itemDeleteBtn" style="margin-right:auto;display:none;">Padam Item</button>
                <button class="btn btn-ghost" type="button" id="itemCancelBtn">Tutup</button>
                <button class="btn btn-main" type="button" id="itemSaveBtn">Simpan</button>
            </div>
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
                    <h4>Spesifikasi Tambahan</h4>
                    <div class="detail-list" id="detailSpecList"></div>
                </section>
            </div>
            <div class="modal-actions">
                <button class="btn btn-ghost" type="button" id="detailCloseBtn">Tutup</button>
            </div>
        </div>
    </div>

        <script>
        const WAREHOUSE_ID = 2;
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
        let inventorySubNav = 'all';
        let componentSpecsState = {};

        const componentSpecTemplates = {
            battery: {
                title: 'Battery Specification',
                subtitle: 'Isi atribut utama bateri seperti kapasiti, warranty dan status pensijilan.',
                fields: [
                    { key: 'brand', label: 'Brand', placeholder: 'Contoh: Asus / Dell' },
                    { key: 'battery_capacity', label: 'Battery Capacity', placeholder: 'Contoh: 4323mAh' },
                    { key: 'dimension', label: 'Dimension (L x W x H)', placeholder: 'Contoh: 28 x 8 x 2 cm' },
                    { key: 'warranty_duration', label: 'Warranty Duration', placeholder: 'Contoh: 6 Months' },
                    { key: 'warranty_type', label: 'Warranty Type', placeholder: 'Contoh: Supplier Warranty' },
                    { key: 'sirim_certified', label: 'SIRIM Certified', type: 'select', options: ['', 'Yes', 'No'] },
                    { key: 'mcmc_approved', label: 'MCMC Approved', type: 'select', options: ['', 'Yes', 'No'] },
                    { key: 'sirim_st_label', label: 'SIRIM-ST Certificate & Label', type: 'select', options: ['', 'Yes', 'No'] },
                    { key: 'sirim_coc', label: 'SIRIM Certificate of Conformity (CoC)', type: 'select', options: ['', 'Yes', 'No'] },
                ],
            },
            ram: {
                title: 'RAM Specification',
                subtitle: 'Isi spesifikasi RAM supaya teknikal item jelas semasa jualan dan servis.',
                fields: [
                    { key: 'brand', label: 'Brand', placeholder: 'Contoh: Kingston / Corsair' },
                    { key: 'series', label: 'Series', placeholder: 'Contoh: Fury Beast' },
                    { key: 'capacity', label: 'Capacity', placeholder: 'Contoh: 16GB (2x8GB)' },
                    { key: 'memory_type', label: 'Memory Type', placeholder: 'Contoh: DDR4 / DDR5' },
                    { key: 'speed', label: 'Speed', placeholder: 'Contoh: 3200MHz' },
                    { key: 'latency', label: 'Latency', placeholder: 'Contoh: CL16' },
                    { key: 'voltage', label: 'Voltage', placeholder: 'Contoh: 1.35V' },
                    { key: 'form_factor', label: 'Form Factor', placeholder: 'Contoh: SO-DIMM / DIMM' },
                    { key: 'warranty_duration', label: 'Warranty Duration', placeholder: 'Contoh: Lifetime' },
                ],
            },
            screen: {
                title: 'Screen Specification',
                subtitle: 'Isi detail panel skrin/lcd termasuk saiz, resolusi dan connector.',
                fields: [
                    { key: 'brand', label: 'Brand', placeholder: 'Contoh: BOE / AUO / LG' },
                    { key: 'model', label: 'Panel Model', placeholder: 'Contoh: NV156FHM-N4K' },
                    { key: 'screen_size', label: 'Screen Size', placeholder: 'Contoh: 15.6 inch' },
                    { key: 'resolution', label: 'Resolution', placeholder: 'Contoh: FHD 1920x1080' },
                    { key: 'refresh_rate', label: 'Refresh Rate', placeholder: 'Contoh: 144Hz' },
                    { key: 'panel_type', label: 'Panel Type', placeholder: 'Contoh: IPS / TN / OLED' },
                    { key: 'connector_type', label: 'Connector Type', placeholder: 'Contoh: eDP 30-pin' },
                    { key: 'surface', label: 'Surface', placeholder: 'Contoh: Matte / Glossy' },
                    { key: 'warranty_duration', label: 'Warranty Duration', placeholder: 'Contoh: 3 Months' },
                ],
            },
            cpu: {
                title: 'CPU Specification',
                subtitle: 'Isi maklumat processor seperti generasi, core/thread dan socket.',
                fields: [
                    { key: 'brand', label: 'Brand', placeholder: 'Contoh: Intel / AMD' },
                    { key: 'series', label: 'Series', placeholder: 'Contoh: Core i7 / Ryzen 7' },
                    { key: 'model', label: 'Model', placeholder: 'Contoh: i7-12700H' },
                    { key: 'generation', label: 'Generation', placeholder: 'Contoh: 12th Gen' },
                    { key: 'cores_threads', label: 'Cores / Threads', placeholder: 'Contoh: 14C/20T' },
                    { key: 'base_clock', label: 'Base Clock', placeholder: 'Contoh: 2.3GHz' },
                    { key: 'boost_clock', label: 'Boost Clock', placeholder: 'Contoh: 4.7GHz' },
                    { key: 'socket', label: 'Socket', placeholder: 'Contoh: LGA1700 / FP6' },
                    { key: 'tdp', label: 'TDP', placeholder: 'Contoh: 45W' },
                    { key: 'warranty_duration', label: 'Warranty Duration', placeholder: 'Contoh: 1 Year' },
                ],
            },
            keyboard: {
                title: 'Laptop Keyboard Specification',
                subtitle: 'Isi layout dan keserasian keyboard laptop untuk elak salah model.',
                fields: [
                    { key: 'brand', label: 'Brand', placeholder: 'Contoh: Lenovo / HP / Dell' },
                    { key: 'compatible_model', label: 'Compatible Model', placeholder: 'Contoh: IdeaPad 3 15ITL6' },
                    { key: 'layout', label: 'Layout', placeholder: 'Contoh: US / UK' },
                    { key: 'language', label: 'Language', placeholder: 'Contoh: English' },
                    { key: 'backlit', label: 'Backlit', type: 'select', options: ['', 'Yes', 'No'] },
                    { key: 'color', label: 'Color', placeholder: 'Contoh: Black' },
                    { key: 'connector_type', label: 'Connector Type', placeholder: 'Contoh: Ribbon 26-pin' },
                    { key: 'frame_type', label: 'Frame Type', placeholder: 'Contoh: With Frame / Without Frame' },
                    { key: 'warranty_duration', label: 'Warranty Duration', placeholder: 'Contoh: 1 Month' },
                ],
            },
            gpu: {
                title: 'GPU Specification',
                subtitle: 'Paparan spec diubah ikut GPU supaya info VRAM, power dan chipset lebih jelas.',
                fields: [
                    { key: 'brand', label: 'Brand', placeholder: 'Contoh: MSI / ASUS / Gigabyte' },
                    { key: 'chipset', label: 'GPU Chipset', placeholder: 'Contoh: NVIDIA RTX 4060' },
                    { key: 'vram', label: 'VRAM', placeholder: 'Contoh: 8GB' },
                    { key: 'memory_type', label: 'Memory Type', placeholder: 'Contoh: GDDR6' },
                    { key: 'boost_clock', label: 'Boost Clock', placeholder: 'Contoh: 2490 MHz' },
                    { key: 'power_draw', label: 'Power / TDP', placeholder: 'Contoh: 115W' },
                    { key: 'power_connector', label: 'Power Connector', placeholder: 'Contoh: 1 x 8-pin' },
                    { key: 'port_output', label: 'Display Output', placeholder: 'Contoh: 3 x DP, 1 x HDMI' },
                    { key: 'dimension', label: 'Dimension', placeholder: 'Contoh: 199 x 120 x 41 mm' },
                    { key: 'warranty_duration', label: 'Warranty Duration', placeholder: 'Contoh: 3 Years' },
                ],
            },
            generic: {
                title: 'Component Specification',
                subtitle: 'Field umum untuk component lain-lain. Isi apa yang sepatutnya ikut jenis item.',
                fields: [
                    { key: 'brand', label: 'Brand', placeholder: 'Contoh: Kingston / Corsair' },
                    { key: 'model', label: 'Model', placeholder: 'Contoh: Fury Beast' },
                    { key: 'spec_1', label: 'Specification 1', placeholder: 'Contoh: DDR4 3200MHz' },
                    { key: 'spec_2', label: 'Specification 2', placeholder: 'Contoh: 16GB Kit' },
                    { key: 'spec_3', label: 'Specification 3', placeholder: 'Contoh: Heatsink Black' },
                    { key: 'warranty_duration', label: 'Warranty Duration', placeholder: 'Contoh: 1 Year' },
                ],
            },
        };

        const flash = document.getElementById('flash');
        const tableWrap = document.getElementById('tableWrap');
        const searchInput = document.getElementById('searchInput');
        const typeFilter = document.getElementById('typeFilter');
        const categoryFilter = document.getElementById('categoryFilter');
        const stockFilter = document.getElementById('stockFilter');
        const imageHoverPreview = document.getElementById('imageHoverPreview');
        const imageHoverPreviewImg = document.getElementById('imageHoverPreviewImg');

        const categoryOptionsByType = {
            PC: [
                'Laptop',
                'Desktop PC',],
                
            Component: [
                'RAM',
                'Screen',
                'CPU',
                'Keyboard Laptop',
                'Battery',
                'GPU',
                'SSD',
                'HDD',
                'Motherboard',
                'Cooling Fan',
                'Power Supply',
                'WiFi Card',
                'Webcam',
                'Speaker',
                'Touchpad',
                'Lain-lain',
            ],
            Accecories: [
                'Mouse',
                'Keyboard',
                'Headset',
                'USB Hub',
                'Adapter',
                'Cable',
                'Laptop Stand',
                'Lain-lain',
            ],
        };

        function renderCategorySelect(selected = '') {
            const type = document.getElementById('iType')?.value || '';
            const categoryEl = document.getElementById('iCategory');
            if (!categoryEl) return;

            const options = categoryOptionsByType[type] || [];
            const placeholder = type ? 'Pilih Category' : 'Pilih Type dahulu';
            categoryEl.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + options.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');

            if (selected && options.includes(selected)) {
                categoryEl.value = selected;
            } else if (selected && !options.includes(selected)) {
                categoryEl.innerHTML += `<option value="${escapeHtml(selected)}">${escapeHtml(selected)}</option>`;
                categoryEl.value = selected;
            } else {
                categoryEl.value = '';
            }
        }

        function toggleItemTypeDependentFields() {
            const type = (document.getElementById('iType')?.value || '').trim();
            const hasType = type !== '';
            const fieldsWrap = document.getElementById('itemFieldsAfterType');
            const typeHint = document.getElementById('itemTypeHint');
            const saveBtn = document.getElementById('itemSaveBtn');

            if (fieldsWrap) fieldsWrap.style.display = hasType ? '' : 'none';
            if (typeHint) typeHint.style.display = hasType ? 'none' : '';
            if (saveBtn) saveBtn.disabled = !hasType;
        }

        function getComponentSpecProfile(category) {
            const value = String(category || '').trim().toLowerCase();
            if (/(battery|bateri)/.test(value)) return 'battery';
            if (/(^|\s)ram(\s|$)|memory/.test(value)) return 'ram';
            if (/(screen|lcd|display|panel)/.test(value)) return 'screen';
            if (/(^|\s)cpu(\s|$)|processor/.test(value)) return 'cpu';
            if (/(keyboard|keypad)/.test(value)) return 'keyboard';
            if (/(gpu|graphic|graphics|vga)/.test(value)) return 'gpu';
            return 'generic';
        }

        function getCurrentComponentTemplate() {
            const categoryValue = document.getElementById('iCategory')?.value || '';
            const profile = getComponentSpecProfile(categoryValue);
            return { profile, ...(componentSpecTemplates[profile] || componentSpecTemplates.generic) };
        }

        function parseComponentSpecs(rawValue) {
            if (!rawValue) return {};
            if (typeof rawValue === 'object') return rawValue;
            try {
                const parsed = JSON.parse(String(rawValue));
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (error) {
                return {};
            }
        }

        function getComponentSpecRows(item) {
            const specs = parseComponentSpecs(item?.component_specs_json || item?.component_specs || '');
            const profile = String(item?.component_profile || getComponentSpecProfile(item?.category || ''));
            const template = componentSpecTemplates[profile] || componentSpecTemplates.generic;
            return template.fields
                .map((field) => ({ label: field.label, value: specs[field.key] || '' }))
                .filter((field) => String(field.value || '').trim() !== '');
        }

        function renderComponentSpecsFields(prefill = null) {
            const wrap = document.getElementById('componentSpecsWrap');
            const grid = document.getElementById('componentSpecsGrid');
            const title = document.getElementById('componentSpecsTitle');
            const sub = document.getElementById('componentSpecsSub');
            const itemType = document.getElementById('iType')?.value || '';

            if (!wrap || !grid || itemType !== 'Component') {
                if (wrap) wrap.classList.add('hidden');
                return;
            }

            const { profile, title: sectionTitle, subtitle, fields } = getCurrentComponentTemplate();
            const values = prefill || componentSpecsState || {};
            componentSpecsState = { ...values };

            wrap.classList.remove('hidden');
            if (title) title.textContent = sectionTitle;
            if (sub) sub.textContent = subtitle;
            grid.innerHTML = fields.map((field) => {
                const value = values[field.key] || '';
                const control = field.type === 'select'
                    ? `<select class="select component-spec-input" data-spec-key="${escapeHtml(field.key)}">${field.options.map((option) => `<option value="${escapeHtml(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(option || 'Please select')}</option>`).join('')}</select>`
                    : `<input class="input component-spec-input" data-spec-key="${escapeHtml(field.key)}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || '')}">`;
                return `<div class="field"><label>${escapeHtml(field.label)}</label>${control}</div>`;
            }).join('');

            grid.querySelectorAll('.component-spec-input').forEach((input) => {
                input.addEventListener('input', () => {
                    componentSpecsState[input.getAttribute('data-spec-key')] = input.value.trim();
                });
                input.addEventListener('change', () => {
                    componentSpecsState[input.getAttribute('data-spec-key')] = input.value.trim();
                });
            });

            componentSpecsState.__profile = profile;
        }

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

        function renderInventorySubNav() {
            document.querySelectorAll('.inventory-subnav-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.getAttribute('data-subnav') === inventorySubNav);
            });
        }

        function togglePcSpecsFields() {
            const typeEl = document.getElementById('iType');
            const specsEl = document.getElementById('pcSpecsGrid');
            if (!typeEl || !specsEl) return;
            const currentCategory = document.getElementById('iCategory')?.value || '';
            toggleItemTypeDependentFields();
            specsEl.classList.toggle('hidden', typeEl.value !== 'PC');
            renderCategorySelect(currentCategory);
            renderComponentSpecsFields();
        }

        function setInventorySubNav(type) {
            inventorySubNav = type || 'all';
            renderInventorySubNav();
            renderTable();
        }

        function getInventorySubType(item) {
            const t = String(item.item_type || '').trim().toLowerCase();
            if (t === 'pc' || t === 'computer' || t === 'komputer') return 'pc';
            if (t === 'component' || t === 'komponen') return 'component';
            if (t === 'accecories' || t === 'accessories' || t === 'accessory' || t === 'aksesori') return 'accesories';
            return '';
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

        function applyTheme(mode) {
            const isLight = mode === 'light';
            document.body.classList.toggle('light-mode', isLight);
            const btn = document.getElementById('themeToggleBtn');
            if (btn) {
                btn.textContent = isLight ? '🌙 Dark' : '☀ Light';
            }

            const logoEl = document.getElementById('sbLogo');
            if (logoEl) {
                logoEl.onerror = () => {
                    logoEl.onerror = null;
                    logoEl.src = 'assets/logo_astech_techlegacy.png';
                };
                logoEl.src = isLight ? 'assets/images(1).png' : 'assets/logo_astech_techlegacy.png';
            }
        }

        function toggleTheme() {
            const isLight = document.body.classList.contains('light-mode');
            const next = isLight ? 'dark' : 'light';
            localStorage.setItem('themeMode', next);
            applyTheme(next);
        }

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
                'warehouse_id' => 2
            ]); ?>;
            const name = user.full_name || user.username || 'Admin Astech';
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

            if (String(item.item_type || '').toUpperCase() === 'PC') {
                const parts = [
                    item.pc_brand,
                    item.pc_model,
                    item.processor_type,
                    item.storage_capacity ? `${item.storage_capacity} ${item.storage_type || ''}`.trim() : '',
                ].filter(Boolean);
                return parts.join(' · ') || item.item_name || item.category || '-';
            }

            if (String(item.item_type || '').toUpperCase() === 'COMPONENT') {
                const rows = getComponentSpecRows(item).slice(0, 3).map((row) => row.value);
                return rows.join(' · ') || item.item_name || item.category || '-';
            }

            return [
                item.item_name,
                item.variant_color,
            ].filter(Boolean).join(' · ') || item.category || '-';
        }

        function getItemLongDescription(item) {
            if (!item) return '-';

            if (String(item.item_type || '').toUpperCase() === 'PC') {
                const lines = [
                    [item.pc_brand, item.pc_device_type, item.pc_model].filter(Boolean).join(' '),
                    [item.processor_type, item.graphics_chipset].filter(Boolean).join(' | '),
                    [item.screen_size, item.panel_type].filter(Boolean).join(' | '),
                    [item.storage_capacity, item.storage_type].filter(Boolean).join(' '),
                    item.port_interface,
                ].filter(Boolean);
                return lines.join(' • ') || item.item_name || item.category || '-';
            }

            if (String(item.item_type || '').toUpperCase() === 'COMPONENT') {
                const rows = getComponentSpecRows(item).map((row) => `${row.label}: ${row.value}`);
                return rows.join(' • ') || item.item_name || item.category || '-';
            }

            return [
                item.item_name,
                item.category,
                item.variant_color ? `Warna ${item.variant_color}` : '',
            ].filter(Boolean).join(' • ') || '-';
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

        function closeDetailModal() {
            activeDetailItemId = 0;
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

        function buildItemCodeFromFields(itemType, category, variantColor) {
            const cleanedType = String(itemType || '')
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .trim();

            if (!cleanedType) {
                return '';
            }

            const firstWord = cleanedType.split(/\s+/)[0] || '';
            const typeMap = {
                ACCESSORY: 'A',
                ACCESSORIES: 'A',
                ACCECORY: 'A',
                ACCECORIES: 'A',
                COMPUTER: 'C',
                PC: 'C',
            };

            const typeCode = typeMap[firstWord] || (firstWord.charAt(0) || '');
            if (!typeCode) {
                return '';
            }

            const prefix = 'AS';
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
                                <br>${escapeHtml(item.variant_color || '-')}
                                <br>Stok semasa: ${formatQty(item.quantity)}
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
                            <th>Gambar</th><th>Tarikh</th><th>ID Item</th><th>Type</th><th>Category</th><th>Variant</th><th>Jenis</th><th>Qty</th><th>Unit Price</th><th>Selling Price</th><th>Nota</th>
                        </tr></thead>
                        <tbody>
                            ${rows.map(r => {
                                const typeLabel = r.movement_type === 'in' ? '⬆ Stock In' : r.movement_type === 'out' ? '⬇ Stock Out' : '↔ Adjust';
                                const typeColor = r.movement_type === 'in' ? 'color:var(--green)' : r.movement_type === 'out' ? 'color:var(--maroon)' : 'color:var(--amber)';
                                const imageUrl = String(r.image_url || '').trim();
                                const imageCell = imageUrl
                                    ? `<img class="item-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(r.category || r.item_name || 'Item')}" loading="lazy">`
                                    : '<div class="item-thumb-placeholder">No Image</div>';
                                return `<tr>
                                    <td>${imageCell}</td>
                                    <td>${escapeHtml(r.created_at || '-')}</td>
                                    <td>${escapeHtml(r.item_code || r.sku || '-')}</td>
                                    <td>${escapeHtml(r.item_type || '-')}</td>
                                    <td>${escapeHtml(r.category || r.item_name || '-')}</td>
                                    <td>${escapeHtml(r.variant_color || '-')}</td>
                                    <td style="${typeColor};font-weight:700;">${typeLabel}</td>
                                    <td>${formatQty(r.quantity)}</td>
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
                const label = `${code} - ${item.category || item.item_name || '-'} (${formatQty(item.quantity)})`;
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
                                <th>Variant</th>
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
                                        <td>${escapeHtml(r.variant_color || '-')}</td>
                                        <td style="${typeStyle}">${typeText}</td>
                                        <td>${formatQty(r.qty)}</td>
                                        <td>${formatQty(r.qty_before)}</td>
                                        <td>${formatQty(r.qty_after)}</td>
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
                                        <div class="analytics-bar-val">${formatQty(c.total_qty)}</div>
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
                                    <div class="top-item-meta">${escapeHtml(item.category || '-')} · ${escapeHtml(item.item_type || '-')} · ${escapeHtml(item.variant_color || '-')}</div>
                                </div>
                                <div class="top-item-qty">${formatQty(item.quantity)}</div>
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
                            <div class="move-sub">${formatQty(mv('in').total_qty)}</div>
                        </div>
                        <div class="analytics-move-card">
                            <div class="move-icon">⬆</div>
                            <div class="move-label">Stock Out</div>
                            <div class="move-val" style="color:var(--maroon);">${mv('out').count}</div>
                            <div class="move-sub">${formatQty(mv('out').total_qty)}</div>
                        </div>
                        <div class="analytics-move-card">
                            <div class="move-icon">↔</div>
                            <div class="move-label">Adjust</div>
                            <div class="move-val" style="color:var(--amber);">${mv('adjust').count}</div>
                            <div class="move-sub">${formatQty(mv('adjust').total_qty)}</div>
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
                            <div class="analytics-rd-sub">${formatQty(ret.total_qty)} dikembalikan</div>
                        </div>
                        <div class="analytics-rd-card damage-card">
                            <div class="analytics-rd-icon">⚠</div>
                            <div class="analytics-rd-label">Damage</div>
                            <div class="analytics-rd-val">${dmg.count}</div>
                            <div class="analytics-rd-sub">${formatQty(dmg.total_qty)} rosak/hilang</div>
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
                                    <div class="top-item-meta">${escapeHtml(item.category || '-')} · ${escapeHtml(item.item_type || '-')} · ${escapeHtml(item.variant_color || '-')}</div>
                                    <div class="analytics-bar-track" style="margin-top:5px;">
                                        <div class="analytics-bar-fill ${color}" style="width:${pct}%"></div>
                                    </div>
                                </div>
                                <div class="top-item-qty" style="color:var(--${color === 'green' ? 'green' : 'maroon'});">${formatQty(item[qtyKey])}</div>
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
                const blob = `${item.item_code || item.sku || ''} ${item.item_name || ''} ${item.category || ''} ${item.item_type || ''} ${item.variant_color || ''}`.toLowerCase();
                const hitKeyword = !keyword || blob.includes(keyword);
                const hitType = !itemType || String(item.item_type || '').toLowerCase() === itemType;
                const hitCategory = !category || String(item.category || '').toLowerCase() === category;
                const isLow = Number(item.is_low_stock || 0) === 1;
                const isOut = Number(item.quantity || 0) <= 0;
                const hitStock = !stock || (stock === 'low' ? isLow : isOut);
                const itemSubType = getInventorySubType(item);
                const hitSubNav = inventorySubNav === 'all' || itemSubType === inventorySubNav;
                return hitKeyword && hitType && hitCategory && hitStock && hitSubNav;
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
                            <th class="sortable-th" onclick="setTableSort('category')">Category (Nama Produk)${getSortIndicator('category')}</th>
                            <th class="sortable-th" onclick="setTableSort('variant')">Variant${getSortIndicator('variant')}</th>
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
                                ? `<img class="item-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.category || item.item_name || 'Astech Item')}" loading="lazy">`
                                : '<div class="item-thumb-placeholder">No Image</div>';

                            return `
                                <tr>
                                    <td>${imageCell}</td>
                                    <td>
                                        <div class="cell-main">${escapeHtml(item.item_code || item.sku || '-')}</div>
                                        <div class="cell-sub">${escapeHtml(item.item_name || '-')}</div>
                                    </td>
                                    <td>${escapeHtml(item.item_type || '-')}</td>
                                    <td>
                                        <div class="cell-main">${escapeHtml(item.category || '-')}</div>
                                        <div class="cell-sub">${escapeHtml(getItemShortDescription(item))}</div>
                                    </td>
                                    <td>${escapeHtml(item.variant_color || '-')}</td>
                                    <td>${formatMoney(item.unit_price)}</td>
                                    <td>${formatMoney(item.selling_price)}</td>
                                    <td>${formatQty(qty)}</td>
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
      
            const category = document.getElementById('iCategory').value.trim();
            const variantColor = document.getElementById('iVariantColor').value.trim();
            const imageUrl = document.getElementById('iImageUrl').value.trim();
            const itemNameInput = document.getElementById('iName').value.trim();
            const quantity = Number(document.getElementById('iQty').value || 0);
            const minimum = Number(document.getElementById('iMinQty').value || 0);
            const unitPrice = Number(document.getElementById('iUnitPrice').value || 0);
            const sellingPrice = Number(document.getElementById('iSellingPrice').value || 0);
            const pcBrand = itemType === 'PC' ? document.getElementById('iPcBrand').value.trim() : '';
            const pcDeviceType = itemType === 'PC' ? document.getElementById('iPcDeviceType').value.trim() : '';
            const pcModel = itemType === 'PC' ? document.getElementById('iPcModel').value.trim() : '';
            const panelType = itemType === 'PC' ? document.getElementById('iPanelType').value.trim() : '';
            const portInterface = itemType === 'PC' ? document.getElementById('iPortInterface').value.trim() : '';
            const screenSize = itemType === 'PC' ? document.getElementById('iScreenSize').value.trim() : '';
            const graphicsChipset = itemType === 'PC' ? document.getElementById('iGraphicsChipset').value.trim() : '';
            const storageCapacity = itemType === 'PC' ? document.getElementById('iStorageCapacity').value.trim() : '';
            const storageType = itemType === 'PC' ? document.getElementById('iStorageType').value.trim() : '';
            const processorType = itemType === 'PC' ? document.getElementById('iProcessorType').value.trim() : '';
            const componentProfile = itemType === 'Component' ? (componentSpecsState.__profile || getCurrentComponentTemplate().profile) : '';
            const componentSpecs = itemType === 'Component'
                ? JSON.stringify(Object.fromEntries(Object.entries(componentSpecsState).filter(([key, value]) => !key.startsWith('__') && String(value || '').trim() !== '')))
                : '';

            if (isUploadingImage) {
                throw new Error('Tunggu upload gambar selesai dahulu.');
            }

            const autoItemCode = buildItemCodeFromFields(itemType, category, variantColor);
            const itemCode = itemCodeInput || autoItemCode;
            const itemName = itemNameInput || (itemType === 'PC'
                ? [pcBrand, pcDeviceType, pcModel].filter(Boolean).join(' ').trim()
                : [itemType, category, variantColor].filter(Boolean).join(' ').trim());

            if (!itemType) {
                throw new Error('Sila pilih Type: PC, Component atau Accecories.');
            }

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
                    variant_color: variantColor,
                    pc_brand: pcBrand,
                    pc_device_type: pcDeviceType,
                    pc_model: pcModel,
                    panel_type: panelType,
                    port_interface: portInterface,
                    screen_size: screenSize,
                    graphics_chipset: graphicsChipset,
                    storage_capacity: storageCapacity,
                    storage_type: storageType,
                    processor_type: processorType,
                    component_profile: componentProfile,
                    component_specs_json: componentSpecs,
                    image_url: imageUrl,
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
                    variant_color: variantColor,
                    pc_brand: pcBrand,
                    pc_device_type: pcDeviceType,
                    pc_model: pcModel,
                    panel_type: panelType,
                    port_interface: portInterface,
                    screen_size: screenSize,
                    graphics_chipset: graphicsChipset,
                    storage_capacity: storageCapacity,
                    storage_type: storageType,
                    processor_type: processorType,
                    component_profile: componentProfile,
                    component_specs_json: componentSpecs,
                    image_url: imageUrl,
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
            document.getElementById('itemModalTitle').textContent = isEdit ? 'Edit Item' : 'Tambah Item';
            document.getElementById('iSku').disabled = isEdit;
            document.getElementById('itemDeleteBtn').style.display = isEdit ? 'inline-flex' : 'none';
            modal.classList.remove('hidden');
        }

        function closeItemModal() {
            editingItemId = 0;
            document.getElementById('itemModal').classList.add('hidden');
            document.getElementById('iSku').value = '';
            document.getElementById('iName').value = '';
            document.getElementById('iType').value = '';
            
            document.getElementById('iCategory').value = '';
            document.getElementById('iVariantColor').value = '';
            document.getElementById('iPcBrand').value = '';
            document.getElementById('iPcDeviceType').value = '';
            document.getElementById('iPcModel').value = '';
            document.getElementById('iPanelType').value = '';
            document.getElementById('iPortInterface').value = '';
            document.getElementById('iScreenSize').value = '';
            document.getElementById('iGraphicsChipset').value = '';
            document.getElementById('iStorageCapacity').value = '';
            document.getElementById('iStorageType').value = '';
            document.getElementById('iProcessorType').value = '';
            document.getElementById('iImageUrl').value = '';
            document.getElementById('iImageFile').value = '';
            componentSpecsState = {};
            document.getElementById('iQty').value = '0';
            document.getElementById('iMinQty').value = '0';
            document.getElementById('iUnitPrice').value = '0';
            document.getElementById('iSellingPrice').value = '0';
            document.getElementById('iSku').disabled = false;
            document.getElementById('itemDeleteBtn').style.display = 'none';
            renderCategorySelect();
            togglePcSpecsFields();
            renderImagePreview('');
        }

        function editItem(itemId) {
            const item = (inventory.items || []).find((x) => Number(x.id) === Number(itemId));
            if (!item) return;
            editingItemId = Number(item.id);
            document.getElementById('iSku').value = item.item_code || item.sku || '';
            document.getElementById('iName').value = item.item_name || '';
            document.getElementById('iType').value = item.item_type || '';
        
            renderCategorySelect(item.category || '');
            document.getElementById('iVariantColor').value = item.variant_color || '';
            document.getElementById('iPcBrand').value = item.pc_brand || '';
            document.getElementById('iPcDeviceType').value = item.pc_device_type || '';
            document.getElementById('iPcModel').value = item.pc_model || '';
            document.getElementById('iPanelType').value = item.panel_type || '';
            document.getElementById('iPortInterface').value = item.port_interface || '';
            document.getElementById('iScreenSize').value = item.screen_size || '';
            document.getElementById('iGraphicsChipset').value = item.graphics_chipset || '';
            document.getElementById('iStorageCapacity').value = item.storage_capacity || '';
            document.getElementById('iStorageType').value = item.storage_type || '';
            document.getElementById('iProcessorType').value = item.processor_type || '';
            componentSpecsState = parseComponentSpecs(item.component_specs_json || item.component_specs || '');
            componentSpecsState.__profile = item.component_profile || getComponentSpecProfile(item.category || '');
            document.getElementById('iImageUrl').value = item.image_url || '';
            document.getElementById('iImageFile').value = '';
            document.getElementById('iQty').value = Number(item.quantity || 0);
            document.getElementById('iMinQty').value = Number(item.minimum_quantity || 0);
            document.getElementById('iUnitPrice').value = Number(item.unit_price || 0);
            document.getElementById('iSellingPrice').value = Number(item.selling_price || 0);
            togglePcSpecsFields();
            renderComponentSpecsFields(componentSpecsState);
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
            const rows = [['ID Item', 'Type', 'Category', 'Variant', 'Item Name', 'Image URL', 'Unit Price', 'Selling Price', 'Quantity', 'Minimum Quantity']];
            (inventory.items || []).forEach((item) => {
                rows.push([
                    item.item_code || item.sku || '',
                    item.item_type || '',
                    item.category || '',
                    item.variant_color || '',
                    item.item_name || '',
                    item.image_url || '',
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
            a.download = 'inventory_astech.csv';
            a.click();
            URL.revokeObjectURL(url);
        }

        function manageCategory() {
            showFlash('Category ikut nilai pada item. Edit item untuk ubah kategori.', 'success');
        }

        document.getElementById('addItemBtn').addEventListener('click', () => openItemModal(false));
        document.getElementById('newItemBtn').addEventListener('click', () => openItemModal(false));
        document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
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
        document.getElementById('iType').addEventListener('change', () => {
            componentSpecsState = {};
            togglePcSpecsFields();
        });
        document.getElementById('iCategory').addEventListener('change', () => {
            if ((document.getElementById('iType')?.value || '') === 'Component') {
                renderComponentSpecsFields(componentSpecsState);
            }
        });

        ['iType', 'iCategory',  'iVariantColor'].forEach((id) => {
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
        document.getElementById('detailModal').addEventListener('click', (e) => {
            if (e.target.id === 'detailModal') closeDetailModal();
        });

        window.editItem = editItem;
        window.openDetailModal = openDetailModal;
        window.openQrItemModal = openQrItemModal;
        window.openStockMove = openStockMove;
        window.updateQrCartQty = updateQrCartQty;
        window.removeQrCartItem = removeQrCartItem;
        window.setTableSort = setTableSort;
        window.setInventorySubNav = setInventorySubNav;
        window.switchPanel = switchPanel;

        (async function init() {
            const savedTheme = localStorage.getItem('themeMode');
            applyTheme(savedTheme === 'light' ? 'light' : 'dark');

            const user = guardRole();
            if (!user) return;

                const dateEl = document.getElementById('topbarDate');
                if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ms-MY', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
            togglePcSpecsFields();
            renderCategorySelect();
            renderComponentSpecsFields();
            renderImagePreview('');
            renderQrCart();
            renderInventorySubNav();

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