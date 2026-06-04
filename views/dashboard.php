<?php
$user = current_user();
$uid = (int) $user['id'];
$role = $user['role_slug'];

$stats = [
    'leads_new' => 0,
    'leads_assigned' => 0,
    'projects_active' => 0,
    'invoices_pending' => 0,
    'tasks_open' => 0,
    'revisions_notify' => 0,
];

if (in_array($role, [ROLE_ADMIN, ROLE_LEAD_FINER], true)) {
    $stats['leads_new'] = (int) $pdo->query("SELECT COUNT(*) FROM leads WHERE status = 'new'")->fetchColumn();
}
if (in_array($role, [ROLE_ADMIN, ROLE_SELLER], true)) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM leads WHERE assigned_seller_id = ? AND status IN ('assigned','contacted','qualified')");
    $stmt->execute([$uid]);
    $stats['leads_assigned'] = (int) $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM projects WHERE seller_id = ? AND status NOT IN ('completed','cancelled','refunded','chargeback')");
    $stmt->execute([$uid]);
    $stats['projects_active'] = (int) $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM project_revisions pr JOIN projects p ON p.id = pr.project_id WHERE p.seller_id = ? AND pr.notify_seller = 1 AND pr.seller_notified_at IS NULL");
    $stmt->execute([$uid]);
    $stats['revisions_notify'] = (int) $stmt->fetchColumn();
}
if (in_array($role, [ROLE_ADMIN, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD], true)) {
    $deptId = (int) ($user['department_id'] ?? 0);
    if ($deptId) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM projects WHERE department_id = ? AND status = 'pending_assignment'");
        $stmt->execute([$deptId]);
        $stats['projects_active'] = (int) $stmt->fetchColumn();
    }
}
if (in_array($role, [ROLE_ADMIN, ROLE_DESIGNER, ROLE_DEVELOPER], true)) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM project_assignments WHERE assignee_id = ? AND status IN ('assigned','in_progress')");
    $stmt->execute([$uid]);
    $stats['tasks_open'] = (int) $stmt->fetchColumn();
}

$recent = $pdo->query(
    "SELECT n.* FROM notifications n WHERE n.user_id = {$uid} ORDER BY n.created_at DESC LIMIT 5"
)->fetchAll();
?>

<div class="stats-grid">
    <?php if (in_array($role, [ROLE_ADMIN, ROLE_LEAD_FINER], true)): ?>
    <div class="stat-card">
        <div class="label">New Leads</div>
        <div class="value"><?= $stats['leads_new'] ?></div>
    </div>
    <?php endif; ?>
    <?php if (in_array($role, [ROLE_ADMIN, ROLE_SELLER], true)): ?>
    <div class="stat-card">
        <div class="label">Active Leads (You)</div>
        <div class="value"><?= $stats['leads_assigned'] ?></div>
    </div>
    <div class="stat-card">
        <div class="label">Active Projects</div>
        <div class="value"><?= $stats['projects_active'] ?></div>
    </div>
    <?php if ($stats['revisions_notify'] > 0): ?>
    <div class="stat-card" style="border-color: var(--warning)">
        <div class="label">Notify Client</div>
        <div class="value"><?= $stats['revisions_notify'] ?></div>
        <a href="<?= e(url('projects')) ?>" class="mt-1" style="font-size:0.85rem">View projects →</a>
    </div>
    <?php endif; ?>
    <?php endif; ?>
    <?php if (in_array($role, [ROLE_ADMIN, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD, ROLE_DESIGNER, ROLE_DEVELOPER], true)): ?>
    <div class="stat-card">
        <div class="label"><?= in_array($role, [ROLE_DESIGNER, ROLE_DEVELOPER]) ? 'My Open Tasks' : 'Pending Assignment' ?></div>
        <div class="value"><?= $stats['tasks_open'] ?: $stats['projects_active'] ?></div>
    </div>
    <?php endif; ?>
</div>

<div class="card">
    <div class="card-header"><h2>Workflow Overview</h2></div>
    <div class="card-body">
        <p class="text-muted mb-0">Lead Finer → Seller (call/email) → Log response → Invoice on win → Auto project → Department head assigns → Developer/Designer work → Submit revision → Seller notifies client → Close or upsell/refund/chargeback.</p>
        <div class="flex mt-2">
            <?php if ($role === ROLE_LEAD_FINER || $role === ROLE_ADMIN): ?>
            <a href="<?= e(url('leads')) ?>" class="btn btn-primary">Manage Leads</a>
            <?php endif; ?>
            <?php if ($role === ROLE_SELLER || $role === ROLE_ADMIN): ?>
            <a href="<?= e(url('seller_workspace')) ?>" class="btn btn-primary">Dialing Workspace</a>
            <a href="<?= e(url('my_leads')) ?>" class="btn btn-secondary">Lead List</a>
            <?php endif; ?>
            <?php if (in_array($role, [ROLE_DESIGN_HEAD, ROLE_DEV_HEAD, ROLE_ADMIN])): ?>
            <a href="<?= e(url('department')) ?>" class="btn btn-secondary">Department Queue</a>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php if ($recent): ?>
<div class="card">
    <div class="card-header"><h2>Recent Notifications</h2></div>
    <div class="card-body">
        <ul class="timeline">
            <?php foreach ($recent as $n): ?>
            <li>
                <strong><?= e($n['title']) ?></strong>
                <p class="mb-0"><?= e($n['message']) ?></p>
                <span class="time"><?= format_datetime($n['created_at']) ?></span>
            </li>
            <?php endforeach; ?>
        </ul>
    </div>
</div>
<?php endif; ?>
