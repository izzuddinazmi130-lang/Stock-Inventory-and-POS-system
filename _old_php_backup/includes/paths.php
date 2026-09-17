<?php
/**
 * Dynamic URL & Path Resolution
 * Automatically detects whether running under:
 * - Apache subdirectory (e.g. /hq-inventory-system/public)
 * - PHP built-in server with root at project root (e.g. localhost:8000/public)
 * - PHP built-in server with root at public/ (e.g. localhost:8000/)
 */

function app_public_path() {
    $script_name = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    
    // Check if the script path contains /public/
    $public_pos = strpos($script_name, '/public/');
    if ($public_pos !== false) {
        return substr($script_name, 0, $public_pos) . '/public';
    }
    
    // Check if document root is public/ (e.g. php -S from public folder)
    $doc_root = str_replace('\\', '/', realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '');
    if (basename($doc_root) === 'public') {
        return '';
    }
    
    // Check if script starts with /public
    if (strpos($script_name, '/public') === 0) {
        return '/public';
    }

    return '';
}

function app_url($path = '') {
    $base = app_public_path();
    $clean_path = ltrim($path, '/');
    if ($base === '') {
        return '/' . $clean_path;
    }
    return rtrim($base, '/') . '/' . $clean_path;
}
