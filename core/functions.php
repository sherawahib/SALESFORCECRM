<?php

declare(strict_types=1);

function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function redirect(string $path): void
{
    global $appConfig;
    $base = rtrim($appConfig['app_url'] ?? '', '/');
    if ($base === '' || str_starts_with($path, 'http')) {
        header('Location: ' . $path);
    } else {
        header('Location: ' . $base . '/' . ltrim($path, '/'));
    }
    exit;
}

function url(string $page = '', array $params = []): string
{
    global $appConfig;
    $base = rtrim($appConfig['app_url'] ?? '', '/');
    $query = array_merge(['page' => $page ?: 'dashboard'], $params);
    return $base . '/index.php?' . http_build_query($query);
}

function asset_url(string $path): string
{
    global $appConfig;
    return rtrim($appConfig['app_url'] ?? '', '/') . '/' . ltrim($path, '/');
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function get_flash(): ?array
{
    if (empty($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}

function setting(PDO $pdo, string $key, ?string $default = null): ?string
{
    $stmt = $pdo->prepare('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? (string) $row['setting_value'] : $default;
}

function generate_code(PDO $pdo, string $prefix, string $table, string $column): string
{
    $year = date('Y');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM {$table} WHERE {$column} LIKE ?");
    $stmt->execute([$prefix . '-' . $year . '-%']);
    $count = (int) $stmt->fetchColumn() + 1;
    return sprintf('%s-%s-%04d', $prefix, $year, $count);
}

function audit_log(PDO $pdo, ?int $userId, string $entityType, int $entityId, string $action, ?array $details = null): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO audit_log (user_id, entity_type, entity_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        $entityType,
        $entityId,
        $action,
        $details ? json_encode($details) : null,
        $_SERVER['REMOTE_ADDR'] ?? null,
    ]);
}

function notify_user(PDO $pdo, int $userId, string $type, string $title, string $message, ?string $link = null): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $type, $title, $message, $link]);
    if (function_exists('crm_email_user')) {
        crm_email_user($pdo, $userId, $title, $message, $link);
    }
}

function notify_admins(PDO $pdo, string $type, string $title, string $message, ?string $link = null): void
{
    $admins = users_by_role($pdo, ROLE_ADMIN);
    foreach ($admins as $a) {
        notify_user($pdo, (int) $a['id'], $type, $title, $message, $link);
    }
}

function format_money(float $amount, string $currency = 'USD'): string
{
    return $currency . ' ' . number_format($amount, 2);
}

function format_datetime(?string $dt): string
{
    if (!$dt) {
        return '—';
    }
    return date('M j, Y g:i A', strtotime($dt));
}

function status_badge(string $status): string
{
    $styles = [
        'new' => 'bg-indigo-100 text-indigo-800',
        'assigned' => 'bg-sky-100 text-sky-800',
        'contacted' => 'bg-sky-100 text-sky-800',
        'qualified' => 'bg-amber-100 text-amber-800',
        'won' => 'bg-emerald-100 text-emerald-800',
        'paid' => 'bg-emerald-100 text-emerald-800',
        'unpaid' => 'bg-slate-100 text-slate-700',
        'partial' => 'bg-amber-100 text-amber-800',
        'lost' => 'bg-red-100 text-red-800',
        'archived' => 'bg-slate-200 text-slate-600',
        'chargeback' => 'bg-red-100 text-red-800',
        'refunded' => 'bg-orange-100 text-orange-800',
        'pending_assignment' => 'bg-amber-100 text-amber-800',
        'in_progress' => 'bg-sky-100 text-sky-800',
        'review_pending' => 'bg-violet-100 text-violet-800',
        'head_review' => 'bg-violet-100 text-violet-800',
        'client_review' => 'bg-amber-100 text-amber-800',
        'revision_requested' => 'bg-amber-100 text-amber-800',
        'open_revision' => 'bg-amber-100 text-amber-800',
        'in_production' => 'bg-sky-100 text-sky-800',
        'completed' => 'bg-emerald-100 text-emerald-800',
        'resolved' => 'bg-emerald-100 text-emerald-800',
        'hot' => 'bg-red-100 text-red-800',
        'cold' => 'bg-slate-100 text-slate-600',
        'upsell' => 'bg-indigo-100 text-indigo-800',
        'original' => 'bg-slate-100 text-slate-700',
    ];
    $class = $styles[$status] ?? 'bg-slate-100 text-slate-700';
    $label = ucwords(str_replace('_', ' ', $status));
    return '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ' . $class . '">' . e($label) . '</span>';
}

function post_int(string $key, int $default = 0): int
{
    return isset($_POST[$key]) ? (int) $_POST[$key] : $default;
}

function post_float(string $key, float $default = 0.0): float
{
    return isset($_POST[$key]) ? (float) $_POST[$key] : $default;
}

function post_string(string $key, string $default = ''): string
{
    return trim((string) ($_POST[$key] ?? $default));
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(): bool
{
    $token = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return $token !== '' && hash_equals($_SESSION['csrf_token'] ?? '', $token);
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

function htmx_redirect(string $path): void
{
    header('HX-Redirect: ' . $path);
    exit;
}
