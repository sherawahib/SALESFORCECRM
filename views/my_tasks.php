<?php
require_roles([ROLE_ADMIN, ROLE_DESIGNER, ROLE_DEVELOPER]);
$user = current_user();
$uid = (int) $user['id'];

$stmt = $pdo->prepare(
    "SELECT pa.*, p.project_code, p.title, p.status AS project_status
     FROM project_assignments pa
     JOIN projects p ON p.id = pa.project_id
     WHERE pa.assignee_id = ? AND pa.status IN ('assigned','in_progress')
     ORDER BY pa.due_date IS NULL, pa.due_date, pa.created_at"
);
$stmt->execute([$uid]);
$tasks = $stmt->fetchAll();
?>

<div class="card">
    <div class="card-header"><h2>My Tasks</h2></div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr><th>Project</th><th>Instructions</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
                <?php foreach ($tasks as $t): ?>
                <tr>
                    <td><strong><?= e($t['project_code']) ?></strong><br><?= e($t['title']) ?></td>
                    <td><?= e(mb_strimwidth($t['instructions'], 0, 120, '…')) ?></td>
                    <td><?= $t['due_date'] ? e($t['due_date']) : '—' ?></td>
                    <td><?= status_badge($t['status']) ?></td>
                    <td>
                        <a href="<?= e(url('project_view', ['id' => $t['project_id']])) ?>" class="btn btn-sm btn-primary">Open & Submit</a>
                        <?php if ($t['status'] === 'assigned'): ?>
                        <form method="post" action="<?= e(url('my_tasks')) ?>" style="display:inline">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="start">
                            <input type="hidden" name="assignment_id" value="<?= (int) $t['id'] ?>">
                            <button type="submit" class="btn btn-sm btn-secondary">Start</button>
                        </form>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
                <?php if (!$tasks): ?>
                <tr><td colspan="5" class="empty-state">No open tasks.</td></tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>
