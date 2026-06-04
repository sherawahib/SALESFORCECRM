<?php
$user = current_user();
$companyName = setting($pdo, 'company_name', $appConfig['app_name'] ?? 'Sales CRM');
$notifCount = $user ? unread_notifications_count($pdo, (int) $user['id']) : 0;
$roleSlug = $user['role_slug'] ?? '';
$baseUrl = rtrim($appConfig['app_url'] ?? '', '/');

$nav = [];
if ($user) {
    $nav[] = ['dashboard', 'Dashboard'];
    if (can_access_page('seller_workspace', $user)) {
        $nav[] = ['seller_workspace', 'Dialing Workspace'];
    }
    if (can_access_page('leads', $user)) {
        $nav[] = ['leads', 'Leads'];
        $nav[] = ['lead_import', 'CSV Import'];
    }
    if (can_access_page('my_leads', $user)) {
        $nav[] = ['my_leads', 'Lead List'];
    }
    if (can_access_page('clients', $user)) {
        $nav[] = ['clients', 'Clients'];
        $nav[] = ['invoices', 'Invoices'];
        $nav[] = ['projects', 'Projects'];
        $nav[] = ['calendar', 'Calendar'];
    }
    if (can_access_page('department', $user)) {
        $nav[] = ['department', 'Dept Queue'];
    }
    if (can_access_page('my_tasks', $user)) {
        $nav[] = ['my_tasks', 'My Tasks'];
    }
    $nav[] = ['notifications', 'Alerts'];
    if (can_access_page('users', $user)) {
        $nav[] = ['users', 'Team'];
    }
    if (can_access_page('reports', $user)) {
        $nav[] = ['reports', 'Reports'];
    }
    if (can_access_page('system_logs', $user)) {
        $nav[] = ['system_logs', 'System Logs'];
    }
    if (can_access_page('settings', $user)) {
        $nav[] = ['settings', 'Settings'];
    }
}
?>
<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($pageTitle) ?> — <?= e($companyName) ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script src="https://unpkg.com/htmx.org@2.0.4"></script>
    <script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','system-ui','sans-serif']}}}}</script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= e(asset_url('assets/css/app.css')) ?>">
</head>
<body class="h-full bg-gray-50 text-gray-800 antialiased" hx-headers='{"X-CSRF-Token": "<?= e(csrf_token()) ?>"}'>
<?php if ($user && ($page ?? '') !== 'login'): ?>
<div class="flex h-full min-h-screen" x-data="{ sidebarOpen: false }">
    <aside class="fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform lg:translate-x-0 lg:static"
           :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'">
        <div class="px-5 py-4 border-b border-slate-800">
            <span class="text-white font-bold text-lg"><?= e($companyName) ?></span>
            <p class="text-xs text-slate-500 mt-1">Sales & Production CRM</p>
        </div>
        <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
            <?php foreach ($nav as [$slug, $label]): ?>
            <a href="<?= e(url($slug)) ?>"
               class="block px-3 py-2 rounded-lg text-sm font-medium transition <?= ($page ?? '') === $slug ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white' ?>">
                <?= e($label) ?>
                <?php if ($slug === 'notifications' && $notifCount > 0): ?>
                <span class="float-right bg-red-500 text-white text-xs px-2 py-0.5 rounded-full"><?= $notifCount ?></span>
                <?php endif; ?>
            </a>
            <?php endforeach; ?>
        </nav>
        <div class="p-4 border-t border-slate-800">
            <p class="text-white text-sm font-medium"><?= e($user['name']) ?></p>
            <p class="text-xs text-slate-500"><?= e($user['role_name']) ?></p>
            <a href="<?= e(url('logout')) ?>" class="mt-2 inline-block text-xs text-slate-400 hover:text-white">Sign out</a>
        </div>
    </aside>
    <div class="flex-1 flex flex-col lg:ml-0 min-w-0">
        <header class="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
            <button type="button" class="lg:hidden p-2 rounded-lg hover:bg-gray-100" @click="sidebarOpen = !sidebarOpen" aria-label="Menu">☰</button>
            <h1 class="text-lg font-semibold text-gray-900 flex-1"><?= e($pageTitle) ?></h1>
            <?php if ($notifCount > 0): ?>
            <a href="<?= e(url('notifications')) ?>" class="text-sm font-medium text-indigo-600"><?= $notifCount ?> alerts</a>
            <?php endif; ?>
        </header>
        <main class="flex-1 p-4 md:p-6 overflow-auto">
            <?php $flash = get_flash(); if ($flash): ?>
            <div class="mb-4 rounded-lg px-4 py-3 text-sm <?= $flash['type'] === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200' ?>">
                <?= e($flash['message']) ?>
            </div>
            <?php endif; ?>
<?php else: ?>
<main class="min-h-screen flex items-center justify-center bg-slate-900">
<?php endif; ?>
