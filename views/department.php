<?php
require_roles([ROLE_ADMIN, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD]);
$user = current_user();
$deptId = (int) ($user['department_id'] ?? 0);

if ($user['role_slug'] === ROLE_ADMIN) {
    $projects = $pdo->query(
        "SELECT p.*, c.contact_name, d.name AS dept_name
         FROM projects p
         JOIN clients c ON c.id = p.client_id
         JOIN departments d ON d.id = p.department_id
         WHERE p.status IN ('pending_assignment','in_progress','revision_requested')
         ORDER BY FIELD(p.status,'pending_assignment','revision_requested','in_progress'), p.created_at"
    )->fetchAll();
} else {
    $stmt = $pdo->prepare(
        "SELECT p.*, c.contact_name, d.name AS dept_name
         FROM projects p
         JOIN clients c ON c.id = p.client_id
         JOIN departments d ON d.id = p.department_id
         WHERE p.department_id = ? AND p.status IN ('pending_assignment','in_progress','revision_requested')
         ORDER BY FIELD(p.status,'pending_assignment','revision_requested','in_progress'), p.created_at"
    );
    $stmt->execute([$deptId]);
    $projects = $stmt->fetchAll();
}
?>

<div class="card">
    <div class="card-header">
        <h2>Department Queue</h2>
        <span class="text-muted">Design → Designers · Development → Dev team</span>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr><th>Code</th><th>Title</th><th>Client</th><th>Department</th><th>Status</th><th>Priority</th><th></th></tr>
            </thead>
            <tbody>
                <?php foreach ($projects as $p): ?>
                <tr>
                    <td><strong><?= e($p['project_code']) ?></strong></td>
                    <td><?= e($p['title']) ?></td>
                    <td><?= e($p['contact_name']) ?></td>
                    <td><?= e($p['dept_name']) ?></td>
                    <td><?= status_badge($p['status']) ?></td>
                    <td><?= $p['status'] === 'revision_requested' ? status_badge('urgent') : '—' ?></td>
                    <td><a href="<?= e(url('project_view', ['id' => $p['id']])) ?>" class="btn btn-sm btn-primary">Manage</a></td>
                </tr>
                <?php endforeach; ?>
                <?php if (!$projects): ?>
                <tr><td colspan="7" class="empty-state">Queue is empty.</td></tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>
