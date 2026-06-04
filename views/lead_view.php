<?php
$user = current_user();
$leadId = (int) ($_GET['id'] ?? 0);

$stmt = $pdo->prepare(
    "SELECT l.*, s.name AS seller_name, c.name AS creator_name
     FROM leads l
     LEFT JOIN users s ON s.id = l.assigned_seller_id
     JOIN users c ON c.id = l.created_by
     WHERE l.id = ?"
);
$stmt->execute([$leadId]);
$lead = $stmt->fetch();
if (!$lead) {
    flash('error', 'Lead not found.');
    redirect('index.php?page=dashboard');
}

$canLogConversation = in_array($user['role_slug'], [ROLE_ADMIN, ROLE_SELLER], true);
if ($user['role_slug'] === ROLE_SELLER && (int) $lead['assigned_seller_id'] !== (int) $user['id']) {
    flash('error', 'This lead is not assigned to you.');
    redirect('index.php?page=my_leads');
}

$activities = $pdo->prepare('SELECT la.*, u.name FROM lead_activities la JOIN users u ON u.id = la.user_id WHERE la.lead_id = ? ORDER BY la.created_at DESC');
$activities->execute([$leadId]);
$activities = $activities->fetchAll();

$conversations = $pdo->prepare('SELECT cv.*, u.name AS seller_name FROM conversations cv JOIN users u ON u.id = cv.seller_id WHERE cv.lead_id = ? ORDER BY cv.created_at DESC');
$conversations->execute([$leadId]);
$conversations = $conversations->fetchAll();

$sellers = users_by_role($pdo, ROLE_SELLER);
$categories = $pdo->query('SELECT sc.*, d.name AS dept_name FROM service_categories sc JOIN departments d ON d.id = sc.department_id ORDER BY sc.name')->fetchAll();
?>

<div class="flex flex-between">
    <div>
        <h2 style="margin:0"><?= e($lead['lead_code']) ?> — <?= e($lead['contact_name']) ?></h2>
        <p class="text-muted"><?= status_badge($lead['status']) ?> <?= status_badge($lead['priority']) ?></p>
    </div>
    <?php if ($lead['status'] === 'won' || $lead['status'] === 'qualified'): ?>
    <a href="<?= e(url('invoices', ['lead_id' => $leadId, 'create' => 1])) ?>" class="btn btn-primary">Create Invoice</a>
    <?php endif; ?>
</div>

<div class="card mt-2">
    <div class="card-header"><h2>Contact Information</h2></div>
    <div class="card-body detail-grid">
        <div class="detail-item"><label>Company</label><span><?= e($lead['company_name'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Phone</label><span><?= e($lead['phone'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Email</label><span><?= e($lead['email'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Website</label><span><?= e($lead['website'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Country</label><span><?= e($lead['country'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Source</label><span><?= e($lead['source'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Interest</label><span><?= e($lead['service_interest'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Budget</label><span><?= e($lead['budget_range'] ?? '—') ?></span></div>
        <div class="detail-item"><label>Seller</label><span><?= e($lead['seller_name'] ?? 'Unassigned') ?></span></div>
        <div class="detail-item" style="grid-column:1/-1"><label>Notes</label><span><?= nl2br(e($lead['notes'] ?? '')) ?></span></div>
    </div>
</div>

<?php if ($canLogConversation): ?>
<div class="card">
    <div class="card-header"><h2>Log Client Response</h2></div>
    <div class="card-body">
        <form method="post" action="<?= e(url('lead_view', ['id' => $leadId])) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="conversation">
            <input type="hidden" name="lead_id" value="<?= $leadId ?>">
            <div class="form-grid">
                <div class="form-group">
                    <label>Channel</label>
                    <select name="channel" required>
                        <option value="call">Phone Call</option>
                        <option value="email">Email</option>
                        <option value="meeting">Meeting</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Outcome</label>
                    <select name="outcome" required>
                        <option value="no_answer">No Answer</option>
                        <option value="follow_up">Follow Up Needed</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="interested">Interested</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="ready_to_buy">Ready to Purchase</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Next Follow-up</label>
                    <input type="date" name="next_follow_up">
                </div>
                <div class="form-group">
                    <label>Update Lead Status</label>
                    <select name="lead_status">
                        <option value="">— Keep current —</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="won">Won / Ready to Buy</option>
                        <option value="lost">Lost</option>
                        <option value="on_hold">On Hold</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Conversation Summary *</label>
                <textarea name="summary" required placeholder="What did the client say? Pricing discussed, objections, next steps..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save Response</button>
        </form>
    </div>
</div>
<?php endif; ?>

<div class="card">
    <div class="card-header"><h2>Conversation History</h2></div>
    <div class="card-body">
        <?php if ($conversations): ?>
        <ul class="timeline">
            <?php foreach ($conversations as $cv): ?>
            <li>
                <strong><?= e(ucfirst($cv['channel'])) ?></strong> — <?= status_badge($cv['outcome']) ?>
                <p><?= nl2br(e($cv['summary'])) ?></p>
                <span class="time"><?= format_datetime($cv['created_at']) ?> by <?= e($cv['seller_name']) ?></span>
            </li>
            <?php endforeach; ?>
        </ul>
        <?php else: ?>
        <p class="text-muted empty-state">No conversations logged yet.</p>
        <?php endif; ?>
    </div>
</div>
