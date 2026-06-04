<?php

declare(strict_types=1);

const ROLE_ADMIN = 'admin';
const ROLE_LEAD_FINDER = 'lead_finer';
const ROLE_LEAD_FINER = 'lead_finer';
const ROLE_SELLER = 'seller';
const ROLE_DESIGN_HEAD = 'design_head';
const ROLE_DEV_HEAD = 'dev_head';
const ROLE_DESIGNER = 'designer';
const ROLE_DEVELOPER = 'developer';

/** Blueprint RBAC: page => allowed role slugs (admin always allowed) */
const RBAC_PAGES = [
    'dashboard' => ['admin', 'lead_finer', 'seller', 'design_head', 'dev_head', 'designer', 'developer'],
    'leads' => ['admin', 'lead_finer'],
    'lead_import' => ['admin', 'lead_finer'],
    'api' => ['admin', 'lead_finer', 'seller', 'design_head', 'dev_head', 'designer', 'developer'],
    'my_leads' => ['admin', 'seller'],
    'seller_workspace' => ['admin', 'seller'],
    'lead_view' => ['admin', 'lead_finer', 'seller'],
    'clients' => ['admin', 'seller'],
    'invoices' => ['admin', 'seller'],
    'invoice_pdf' => ['admin', 'seller'],
    'download' => ['admin', 'seller', 'design_head', 'dev_head', 'designer', 'developer'],
    'projects' => ['admin', 'seller', 'design_head', 'dev_head', 'designer', 'developer'],
    'project_view' => ['admin', 'seller', 'design_head', 'dev_head', 'designer', 'developer'],
    'department' => ['admin', 'design_head', 'dev_head'],
    'my_tasks' => ['admin', 'designer', 'developer'],
    'calendar' => ['admin', 'seller'],
    'users' => ['admin'],
    'notifications' => ['admin', 'lead_finer', 'seller', 'design_head', 'dev_head', 'designer', 'developer'],
    'reports' => ['admin'],
    'settings' => ['admin'],
    'system_logs' => ['admin'],
];

function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function require_login(): array
{
    $user = current_user();
    if (!$user) {
        redirect('index.php?page=login');
    }
    return $user;
}

function can_access_page(string $page, ?array $user = null): bool
{
    $user = $user ?? current_user();
    if (!$user) {
        return false;
    }
    if ($user['role_slug'] === ROLE_ADMIN) {
        return true;
    }
    $allowed = RBAC_PAGES[$page] ?? null;
    if ($allowed === null) {
        return true;
    }
    return in_array($user['role_slug'], $allowed, true);
}

function require_roles(array $roles): array
{
    $user = require_login();
    if (!in_array($user['role_slug'], $roles, true) && $user['role_slug'] !== ROLE_ADMIN) {
        flash('error', 'You do not have permission to access this page.');
        redirect('index.php?page=dashboard');
    }
    return $user;
}

function require_page_access(string $page): array
{
    $user = require_login();
    if (!can_access_page($page, $user)) {
        flash('error', 'Access denied for your role.');
        redirect('index.php?page=dashboard');
    }
    return $user;
}

function login_user(PDO $pdo, string $email, string $password): bool
{
    $stmt = $pdo->prepare(
        'SELECT u.*, r.slug AS role_slug, r.name AS role_name, d.slug AS department_slug
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.email = ? AND u.is_active = 1 LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        return false;
    }
    unset($user['password_hash']);
    $_SESSION['user'] = $user;
    return true;
}

function logout_user(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function users_by_role(PDO $pdo, string $roleSlug): array
{
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE r.slug = ? AND u.is_active = 1 ORDER BY u.name'
    );
    $stmt->execute([$roleSlug]);
    return $stmt->fetchAll();
}

function department_heads(PDO $pdo, int $departmentId): array
{
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.department_id = ? AND u.is_active = 1
         AND r.slug IN (?, ?) ORDER BY u.name'
    );
    $stmt->execute([$departmentId, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD]);
    return $stmt->fetchAll();
}

function team_members(PDO $pdo, int $headId, string $deptSlug): array
{
    $role = $deptSlug === 'design' ? ROLE_DESIGNER : ROLE_DEVELOPER;
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.manager_id = ? AND r.slug = ? AND u.is_active = 1 ORDER BY u.name'
    );
    $stmt->execute([$headId, $role]);
    return $stmt->fetchAll();
}

function unread_notifications_count(PDO $pdo, int $userId): int
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0');
    $stmt->execute([$userId]);
    return (int) $stmt->fetchColumn();
}

function is_htmx_request(): bool
{
    return isset($_SERVER['HTTP_HX_REQUEST']) || isset($_SERVER['HTTP_X_REQUESTED_WITH']);
}
