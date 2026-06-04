<?php
require_roles([ROLE_ADMIN, ROLE_SELLER]);
$user = current_user();

if ($user['role_slug'] === ROLE_ADMIN) {
    $clients = $pdo->query(
        "SELECT c.*, u.name AS seller_name, COUNT(p.id) AS project_count
         FROM clients c
         JOIN users u ON u.id = c.seller_id
         LEFT JOIN projects p ON p.client_id = c.id
         GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200"
    )->fetchAll();
} else {
    $stmt = $pdo->prepare(
        "SELECT c.*, u.name AS seller_name, COUNT(p.id) AS project_count
         FROM clients c
         JOIN users u ON u.id = c.seller_id
         LEFT JOIN projects p ON p.client_id = c.id
         WHERE c.seller_id = ? GROUP BY c.id ORDER BY c.created_at DESC"
    );
    $stmt->execute([(int) $user['id']]);
    $clients = $stmt->fetchAll();
}
?>

<div class="card">
    <div class="card-header"><h2>Clients</h2></div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Projects</th><th>Seller</th><th>Since</th></tr>
            </thead>
            <tbody>
                <?php foreach ($clients as $c): ?>
                <tr>
                    <td><strong><?= e($c['contact_name']) ?></strong></td>
                    <td><?= e($c['company_name'] ?? '—') ?></td>
                    <td><?= e($c['email'] ?? '—') ?></td>
                    <td><?= e($c['phone'] ?? '—') ?></td>
                    <td><?= (int) $c['project_count'] ?></td>
                    <td><?= e($c['seller_name']) ?></td>
                    <td><?= format_datetime($c['created_at']) ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
