<?php
require_roles([ROLE_ADMIN, ROLE_SELLER]);
$user = current_user();
$uid = (int) $user['id'];

if ($user['role_slug'] === ROLE_ADMIN) {
    $leads = $pdo->query(
        "SELECT l.* FROM leads l WHERE l.status NOT IN ('lost','won') ORDER BY FIELD(l.priority,'urgent','high','medium','low'), l.updated_at DESC LIMIT 100"
    )->fetchAll();
} else {
    $stmt = $pdo->prepare(
        "SELECT l.* FROM leads l
         WHERE l.assigned_seller_id = ? AND l.status NOT IN ('lost','won')
         ORDER BY FIELD(l.priority,'urgent','high','medium','low'), l.updated_at DESC"
    );
    $stmt->execute([$uid]);
    $leads = $stmt->fetchAll();
}
?>

<div class="card">
    <div class="card-header">
        <h2>Leads for Dialing & Email</h2>
        <span class="text-muted">Complete contact details for outreach</span>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Contact / Company</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Interest</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($leads as $l): ?>
                <tr>
                    <td><strong><?= e($l['lead_code']) ?></strong></td>
                    <td>
                        <strong><?= e($l['contact_name']) ?></strong><br>
                        <?= e($l['company_name'] ?? '—') ?>
                    </td>
                    <td>
                        <?php if ($l['phone']): ?>
                        <a href="tel:<?= e(preg_replace('/\s+/', '', $l['phone'])) ?>"><?= e($l['phone']) ?></a>
                        <?php else: ?>—<?php endif; ?>
                    </td>
                    <td>
                        <?php if ($l['email']): ?>
                        <a href="mailto:<?= e($l['email']) ?>"><?= e($l['email']) ?></a>
                        <?php else: ?>—<?php endif; ?>
                    </td>
                    <td><?= e($l['service_interest'] ?? '—') ?><br><small class="text-muted"><?= e($l['budget_range'] ?? '') ?></small></td>
                    <td><?= status_badge($l['status']) ?></td>
                    <td><small><?= e(mb_strimwidth($l['notes'] ?? '', 0, 60, '…')) ?></small></td>
                    <td><a href="<?= e(url('lead_view', ['id' => $l['id']])) ?>" class="btn btn-sm btn-primary">Work Lead</a></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
