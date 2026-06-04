<?php

declare(strict_types=1);

define('CRM_ROOT', dirname(__DIR__));

$configPath = CRM_ROOT . '/config/config.php';
if (!is_file($configPath)) {
    header('Location: install/');
    exit;
}

$config = require $configPath;
date_default_timezone_set($config['timezone'] ?? 'UTC');

if (!empty($config['debug'])) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
    ini_set('display_errors', '0');
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/project_helpers.php';
require_once __DIR__ . '/LeadService.php';
require_once __DIR__ . '/Mailer.php';
require_once __DIR__ . '/InvoiceBranding.php';
require_once __DIR__ . '/InvoicePdf.php';
require_once __DIR__ . '/FileUpload.php';

session_name($config['session_name'] ?? 'sales_crm_session');
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$pdo = db_connect($config['db']);
$appConfig = $config;
