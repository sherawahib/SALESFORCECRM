<?php
$user = current_user();
$companyName = setting($pdo, 'company_name', $appConfig['app_name'] ?? 'Sales CRM');
$notifCount = $user ? unread_notifications_count($pdo, (int) $user['id']) : 0;
$roleSlug = $user['role_slug'] ?? '';

$nav = [];
if ($user) {
    $nav[] = ['dashboard', 'Dashboard', 'grid'];
    if (in_array($roleSlug, [ROLE_ADMIN, ROLE_LEAD_FINER], true)) {
        $nav[] = ['leads', 'Leads', 'users'];
        if ($roleSlug === ROLE_ADMIN) {
            $nav[] = ['users', 'Team', 'user-check'];
        }
    }
    if (in_array($roleSlug, [ROLE_ADMIN, ROLE_SELLER], true)) {
        $nav[] = ['my_leads', 'My Leads', 'phone'];
        $nav[] = ['clients', 'Clients', 'briefcase'];
        $nav[] = ['invoices', 'Invoices', 'file-text'];
        $nav[] = ['projects', 'Projects', 'folder'];
    }
    if (in_array($roleSlug, [ROLE_ADMIN, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD], true)) {
        $nav[] = ['department', 'Department Queue', 'layers'];
    }
    if (in_array($roleSlug, [ROLE_ADMIN, ROLE_DESIGNER, ROLE_DEVELOPER], true)) {
        $nav[] = ['my_tasks', 'My Tasks', 'check-square'];
    }
    $nav[] = ['notifications', 'Notifications', 'bell'];
    if ($roleSlug === ROLE_ADMIN) {
        $nav[] = ['reports', 'Reports', 'bar-chart'];
        $nav[] = ['settings', 'Settings', 'settings'];
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($pageTitle) ?> — <?= e($companyName) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= e(rtrim($appConfig['app_url'] ?? '', '/')) ?>/assets/css/app.css">
</head>
<body>
<?php if ($user && ($page ?? '') !== 'login'): ?>
<div class="app-shell">
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <span class="brand-icon">◆</span>
            <span class="brand-text"><?= e($companyName) ?></span>
        </div>
        <nav class="sidebar-nav">
            <?php foreach ($nav as [$slug, $label, $icon]): ?>
            <a href="<?= e(url($slug)) ?>" class="nav-item <?= ($page ?? '') === $slug ? 'active' : '' ?>">
                <svg class="nav-icon" aria-hidden="true"><use href="#icon-<?= e($icon) ?>"/></svg>
                <span><?= e($label) ?></span>
                <?php if ($slug === 'notifications' && $notifCount > 0): ?>
                <span class="nav-badge"><?= $notifCount ?></span>
                <?php endif; ?>
            </a>
            <?php endforeach; ?>
        </nav>
        <div class="sidebar-user">
            <div class="user-meta">
                <strong><?= e($user['name']) ?></strong>
                <small><?= e($user['role_name']) ?></small>
            </div>
            <a href="<?= e(url('logout')) ?>" class="btn btn-ghost btn-sm">Sign out</a>
        </div>
    </aside>
    <div class="main-wrap">
        <header class="topbar">
            <button type="button" class="menu-toggle" id="menuToggle" aria-label="Toggle menu">☰</button>
            <h1 class="page-heading"><?= e($pageTitle) ?></h1>
            <div class="topbar-actions">
                <?php if ($notifCount > 0): ?>
                <a href="<?= e(url('notifications')) ?>" class="topbar-notif"><?= $notifCount ?> new</a>
                <?php endif; ?>
            </div>
        </header>
        <main class="content">
            <?php $flash = get_flash(); if ($flash): ?>
            <div class="alert alert-<?= e($flash['type']) ?>"><?= e($flash['message']) ?></div>
            <?php endif; ?>
<?php else: ?>
<main class="content content-auth">
<?php endif; ?>
