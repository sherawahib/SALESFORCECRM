<?php
require_roles([ROLE_ADMIN, ROLE_LEAD_FINER]);
$user = current_user();

$sellers = users_by_role($pdo, ROLE_SELLER);
$filter = $_GET['status'] ?? '';

$sql = "SELECT l.*, u.name AS creator_name, s.name AS seller_name
        FROM leads l
        JOIN users u ON u.id = l.created_by
        LEFT JOIN users s ON s.id = l.assigned_seller_id
        WHERE 1=1";
$params = [];
if ($filter !== '') {
    $sql .= " AND l.status = ?";
    $params[] = $filter;
}
$sql .= " ORDER BY l.created_at DESC LIMIT 200";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$leads = $stmt->fetchAll();
?>

<div class="flex flex-between mb-0">
    <div class="flex">
        <a href="<?= e(url('leads')) ?>" class="btn btn-sm <?= $filter === '' ? 'btn-primary' : 'btn-secondary' ?>">All</a>
        <?php foreach (['new','assigned','contacted','qualified','won','lost'] as $st): ?>
        <a href="<?= e(url('leads', ['status' => $st])) ?>" class="btn btn-sm <?= $filter === $st ? 'btn-primary' : 'btn-secondary' ?>"><?= e(ucfirst($st)) ?></a>
        <?php endforeach; ?>
    </div>
    <button type="button" class="btn btn-primary" onclick="document.getElementById('leadForm').style.display='block'">+ New Lead</button>
</div>

<div class="card mt-2" id="leadForm" style="display:none">
    <div class="card-header"><h2>Add Lead</h2></div>
    <div class="card-body">
        <form method="post" action="<?= e(url('leads')) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create">
            <div class="form-grid">
                <div class="form-group">
                    <label>Contact Name *</label>
                    <input type="text" name="contact_name" required>
                </div>
                <div class="form-group">
                    <label>Company</label>
                    <input type="text" name="company_name">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email">
                </div>
                <div class="form-group">
                    <label>Phone *</label>
                    <input type="text" name="phone" required>
                </div>
                <div class="form-group">
                    <label>Website</label>
                    <input type="url" name="website">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" name="country">
                </div>
                <div class="form-group">
                    <label>Lead Source</label>
                    <input type="text" name="source" placeholder="LinkedIn, Referral, etc.">
                </div>
                <div class="form-group">
                    <label>Service Interest</label>
                    <input type="text" name="service_interest">
                </div>
                <div class="form-group">
                    <label>Budget Range</label>
                    <input type="text" name="budget_range">
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <select name="priority">
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Assign to Seller</label>
                    <select name="assigned_seller_id">
                        <option value="">— Unassigned —</option>
                        <?php foreach ($sellers as $s): ?>
                        <option value="<?= (int) $s['id'] ?>"><?= e($s['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save Lead</button>
        </form>
    </div>
</div>

<div class="card">
    <div class="card-header"><h2>All Leads</h2></div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Contact</th>
                    <th>Phone / Email</th>
                    <th>Seller</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Created</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($leads as $l): ?>
                <tr>
                    <td><strong><?= e($l['lead_code']) ?></strong></td>
                    <td><?= e($l['contact_name']) ?><br><small class="text-muted"><?= e($l['company_name'] ?? '') ?></small></td>
                    <td><?= e($l['phone']) ?><br><small><?= e($l['email'] ?? '') ?></small></td>
                    <td><?= e($l['seller_name'] ?? '—') ?></td>
                    <td><?= status_badge($l['status']) ?></td>
                    <td><?= status_badge($l['priority']) ?></td>
                    <td><?= format_datetime($l['created_at']) ?></td>
                    <td class="actions"><a href="<?= e(url('lead_view', ['id' => $l['id']])) ?>">View</a></td>
                </tr>
                <?php endforeach; ?>
                <?php if (!$leads): ?>
                <tr><td colspan="8" class="empty-state">No leads yet.</td></tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>
