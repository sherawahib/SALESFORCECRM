<?php
require_roles([ROLE_ADMIN, ROLE_SELLER, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD, ROLE_DESIGNER, ROLE_DEVELOPER]);
$user = current_user();
$role = $user['role_slug'];
$uid = (int) $user['id'];

$sql = "SELECT p.*, c.contact_name, d.name AS dept_name, sc.name AS category_name
        FROM projects p
        JOIN clients c ON c.id = p.client_id
        JOIN departments d ON d.id = p.department_id
        JOIN service_categories sc ON sc.id = p.service_category_id
        WHERE 1=1";
$params = [];

if ($role === ROLE_SELLER) {
    $sql .= ' AND p.seller_id = ?';
    $params[] = $uid;
} elseif (in_array($role, [ROLE_DESIGN_HEAD, ROLE_DEV_HEAD], true)) {
    $sql .= ' AND p.department_id = ?';
    $params[] = (int) $user['department_id'];
} elseif (in_array($role, [ROLE_DESIGNER, ROLE_DEVELOPER], true)) {
    $sql .= ' AND EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = p.id AND pa.assignee_id = ?)';
    $params[] = $uid;
}

$sql .= ' ORDER BY p.updated_at DESC LIMIT 150';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$projects = $stmt->fetchAll();
?>

<div class="card">
    <div class="card-header"><h2>Projects</h2></div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Title</th>
                    <th>Client</th>
                    <th>Department</th>
                    <th>Budget</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($projects as $p): ?>
                <tr>
                    <td><strong><?= e($p['project_code']) ?></strong></td>
                    <td><?= e($p['title']) ?></td>
                    <td><?= e($p['contact_name']) ?></td>
                    <td><?= e($p['dept_name']) ?></td>
                    <td><?= format_money((float) $p['budget_total']) ?></td>
                    <td><?= status_badge($p['status']) ?></td>
                    <td><?= format_datetime($p['updated_at']) ?></td>
                    <td><a href="<?= e(url('project_view', ['id' => $p['id']])) ?>" class="btn btn-sm btn-primary">Open</a></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
