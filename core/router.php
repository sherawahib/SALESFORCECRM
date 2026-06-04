<?php

declare(strict_types=1);

$page = preg_replace('/[^a-z0-9_]/', '', strtolower($_GET['page'] ?? 'dashboard'));

$publicPages = ['login'];
if (!in_array($page, $publicPages, true)) {
    require_page_access($page);
}

if ($page === 'invoice_pdf') {
    require_roles([ROLE_ADMIN, ROLE_SELLER]);
    stream_invoice_pdf($pdo, (int) ($_GET['id'] ?? 0));
}

if ($page === 'download') {
    require_login();
    $fileId = (int) ($_GET['id'] ?? 0);
    $stmt = $pdo->prepare(
        'SELECT rf.*, p.seller_id, p.department_id FROM revision_files rf
         JOIN projects p ON p.id = rf.project_id WHERE rf.id = ?'
    );
    $stmt->execute([$fileId]);
    $file = $stmt->fetch();
    if (!$file || !is_file(CRM_ROOT . '/' . $file['file_path'])) {
        http_response_code(404);
        exit('File not found');
    }
    $user = current_user();
    $ok = $user['role_slug'] === ROLE_ADMIN
        || (int) $file['seller_id'] === (int) $user['id']
        || in_array($user['role_slug'], [ROLE_DESIGN_HEAD, ROLE_DEV_HEAD, ROLE_DESIGNER, ROLE_DEVELOPER], true);
    if (!$ok) {
        http_response_code(403);
        exit('Access denied');
    }
    $full = CRM_ROOT . '/' . $file['file_path'];
    header('Content-Type: ' . ($file['mime_type'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . basename($file['original_name']) . '"');
    header('Content-Length: ' . filesize($full));
    readfile($full);
    exit;
}

$actionPaths = [
    CRM_ROOT . '/actions/' . $page . '.php',
    CRM_ROOT . '/core/actions/' . $page . '.php',
];
$runAction = ($_SERVER['REQUEST_METHOD'] === 'POST' || in_array($page, ['logout', 'api'], true));
if ($runAction) {
    foreach ($actionPaths as $actionFile) {
        if (is_file($actionFile)) {
            require $actionFile;
            exit;
        }
    }
}

$viewPaths = [
    CRM_ROOT . '/dashboards/' . $page . '.php',
    CRM_ROOT . '/views/' . $page . '.php',
];
$viewFile = null;
foreach ($viewPaths as $path) {
    if (is_file($path)) {
        $viewFile = $path;
        break;
    }
}
if (!$viewFile) {
    $page = 'dashboard';
    $viewFile = CRM_ROOT . '/views/dashboard.php';
}

$pageTitle = ucwords(str_replace('_', ' ', $page));
require CRM_ROOT . '/components/layout/header.php';
require $viewFile;
require CRM_ROOT . '/components/layout/footer.php';
