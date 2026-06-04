<?php
$user = current_user();
$projectId = (int) ($_GET['id'] ?? 0);

$stmt = $pdo->prepare(
    "SELECT p.*, c.contact_name, c.email AS client_email, c.phone AS client_phone,
            sc.name AS category_name, d.name AS dept_name, d.slug AS dept_slug,
            seller.name AS seller_name, head.name AS head_name
     FROM projects p
     JOIN clients c ON c.id = p.client_id
     JOIN service_categories sc ON sc.id = p.service_category_id
     JOIN departments d ON d.id = p.department_id
     JOIN users seller ON seller.id = p.seller_id
     LEFT JOIN users head ON head.id = p.head_user_id
     WHERE p.id = ?"
);
$stmt->execute([$projectId]);
$project = $stmt->fetch();
if (!$project) {
    flash('error', 'Project not found.');
    redirect('index.php?page=projects');
}

$role = $user['role_slug'];
$uid = (int) $user['id'];
$isSeller = $role === ROLE_SELLER && (int) $project['seller_id'] === $uid;
$isHead = in_array($role, [ROLE_DESIGN_HEAD, ROLE_DEV_HEAD, ROLE_ADMIN], true)
    && ($role === ROLE_ADMIN || (int) $project['department_id'] === (int) $user['department_id']);
$isDev = in_array($role, [ROLE_DESIGNER, ROLE_DEVELOPER], true);

$budgetLines = $pdo->prepare('SELECT bl.*, u.name AS creator FROM project_budget_lines bl JOIN users u ON u.id = bl.created_by WHERE bl.project_id = ? ORDER BY bl.created_at');
$budgetLines->execute([$projectId]);
$budgetLines = $budgetLines->fetchAll();

$assignments = $pdo->prepare(
    'SELECT pa.*, u.name AS assignee_name, ab.name AS assigned_by_name
     FROM project_assignments pa
     JOIN users u ON u.id = pa.assignee_id
     JOIN users ab ON ab.id = pa.assigned_by
     WHERE pa.project_id = ? ORDER BY pa.created_at DESC'
);
$assignments->execute([$projectId]);
$assignments = $assignments->fetchAll();

$revisions = $pdo->prepare(
    'SELECT pr.*, u.name AS opened_by_name, a.name AS assignee_name
     FROM project_revisions pr
     JOIN users u ON u.id = pr.opened_by
     LEFT JOIN users a ON a.id = pr.assignee_id
     WHERE pr.project_id = ? ORDER BY pr.revision_number ASC'
);
$revisions->execute([$projectId]);
$revisions = $revisions->fetchAll();

$statusLog = $pdo->prepare(
    'SELECT psl.*, u.name FROM project_status_log psl JOIN users u ON u.id = psl.user_id WHERE psl.project_id = ? ORDER BY psl.created_at DESC LIMIT 30'
);
$statusLog->execute([$projectId]);
$statusLog = $statusLog->fetchAll();

$team = $isHead ? team_members($pdo, $uid, $project['dept_slug']) : [];
if ($role === ROLE_ADMIN && $project['head_user_id']) {
    $team = team_members($pdo, (int) $project['head_user_id'], $project['dept_slug']);
}

$pendingNotify = array_filter($revisions, fn($r) => !empty($r['notify_seller']) && empty($r['seller_notified_at']) && $r['status'] === 'client_review');

$filesByRevision = [];
try {
    $allFiles = $pdo->prepare(
        'SELECT rf.*, u.name AS uploader FROM revision_files rf JOIN users u ON u.id = rf.uploaded_by WHERE rf.project_id = ? ORDER BY rf.created_at'
    );
    $allFiles->execute([$projectId]);
    foreach ($allFiles->fetchAll() as $f) {
        $key = $f['revision_id'] ?? 0;
        $filesByRevision[$key][] = $f;
    }
} catch (Throwable $e) {
    $filesByRevision = [];
}
$baseContract = 0.0;
$upsellTotal = 0.0;
foreach ($budgetLines as $bl) {
    if ($bl['line_type'] === 'original') {
        $baseContract += (float) $bl['amount'];
    } elseif ($bl['line_type'] === 'upsell') {
        $upsellTotal += (float) $bl['amount'];
    }
}
?>

<?php if (!empty($project['is_frozen'])): ?>
<div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm font-medium">
    CHARGEBACK — Production frozen. Client communication locked except admin escalation.
</div>
<?php endif; ?>

<div class="flex flex-wrap justify-between gap-4 mb-4">
    <div>
        <h2 style="margin:0"><?= e($project['project_code']) ?></h2>
        <p class="text-muted"><?= e($project['title']) ?> · <?= status_badge($project['status']) ?></p>
    </div>
    <?php if ($isSeller || $role === ROLE_ADMIN): ?>
    <div class="flex">
        <?php if (!in_array($project['status'], ['completed', 'cancelled', 'refunded', 'chargeback'], true)): ?>
        <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>" style="display:inline">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="close_project">
            <input type="hidden" name="project_id" value="<?= $projectId ?>">
            <button type="submit" class="btn btn-primary" onclick="return confirm('Mark project as completed?')">Close Project</button>
        </form>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>

<?php if ($pendingNotify && ($isSeller || $role === ROLE_ADMIN)): ?>
<div class="alert alert-info">
    <strong>Action required:</strong> Developer submitted work — notify your client and mark as notified.
    <?php foreach ($pendingNotify as $rev): ?>
    <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>" class="mt-1">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="seller_notified">
        <input type="hidden" name="revision_id" value="<?= (int) $rev['id'] ?>">
        <button type="submit" class="btn btn-sm btn-primary">Revision #<?= (int) $rev['revision_number'] ?> — Mark Client Notified</button>
    </form>
    <?php endforeach; ?>
</div>
<?php endif; ?>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
    <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 uppercase font-semibold">Base Contract</p>
        <p class="text-xl font-bold text-gray-900"><?= format_money($baseContract) ?></p>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 uppercase font-semibold">Total Upsells</p>
        <p class="text-xl font-bold text-indigo-600"><?= format_money($upsellTotal) ?></p>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 uppercase font-semibold">Total Budget (paid)</p>
        <p class="text-xl font-bold text-emerald-700"><?= format_money((float) $project['budget_total']) ?></p>
    </div>
</div>
<p class="text-sm text-slate-600 mt-2">Client: <strong><?= e($project['contact_name']) ?></strong> · Seller: <?= e($project['seller_name']) ?> · Head: <?= e($project['head_name'] ?? '—') ?></p>

<div class="card">
    <div class="card-header"><h2>Project Budget (Original + Upsells)</h2></div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>By</th></tr></thead>
            <tbody>
                <?php foreach ($budgetLines as $bl): ?>
                <tr>
                    <td><?= format_datetime($bl['created_at']) ?></td>
                    <td><?= status_badge($bl['line_type']) ?></td>
                    <td><?= e($bl['description']) ?></td>
                    <td><?= format_money((float) $bl['amount']) ?></td>
                    <td><?= e($bl['creator']) ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php if ($isSeller && !in_array($project['status'], ['completed', 'refunded', 'chargeback'], true)): ?>
    <div class="card-body" style="border-top:1px solid var(--border)">
        <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="upsell">
            <input type="hidden" name="project_id" value="<?= $projectId ?>">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label class="text-sm font-medium">Upsell Description</label><input type="text" name="description" required class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
                <div><label class="text-sm font-medium">Amount</label><input type="number" name="amount" step="0.01" required class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
            </div>
            <label class="inline-flex items-center gap-2 mt-2 text-sm"><input type="checkbox" name="mark_upsell_paid" value="1"> Mark upsell paid now (adds to budget)</label>
            <button type="submit" class="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">+ Add Upsell Milestone</button>
        </form>
        <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>" class="mt-2">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="financial_status">
            <input type="hidden" name="project_id" value="<?= $projectId ?>">
            <div class="flex">
                <select name="financial_status" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="refunded">Full Refund</option>
                    <option value="chargeback">Chargeback Escalation</option>
                </select>
                <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium" onclick="return confirm('Update financial status?')">Escalate</button>
            </div>
        </form>
    </div>
    <?php endif; ?>
</div>

<?php if ($isHead): ?>
<div class="card">
    <div class="card-header"><h2>Assign to Team</h2></div>
    <div class="card-body">
        <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="assign">
            <input type="hidden" name="project_id" value="<?= $projectId ?>">
            <div class="form-grid">
                <div class="form-group">
                    <label>Team Member</label>
                    <select name="assignee_id" required>
                        <?php foreach ($team as $m): ?>
                        <option value="<?= (int) $m['id'] ?>"><?= e($m['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>Due Date</label>
                    <input type="date" name="due_date">
                </div>
            </div>
            <div class="form-group">
                <label>Instructions *</label>
                <textarea name="instructions" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Assign Task</button>
        </form>
    </div>
</div>
<?php endif; ?>

<?php if ($isDev || $isHead): ?>
<div class="card">
    <div class="card-header"><h2>My Assignment / Submit Work</h2></div>
    <div class="card-body">
        <?php
        $myAssign = array_filter($assignments, fn($a) => (int) $a['assignee_id'] === $uid || $isHead);
        foreach ($myAssign as $a):
        ?>
        <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
            <p><strong><?= e($a['assignee_name']) ?></strong> — <?= status_badge($a['status']) ?></p>
            <p><?= nl2br(e($a['instructions'])) ?></p>
            <?php if ((int) $a['assignee_id'] === $uid && in_array($a['status'], ['assigned', 'in_progress'], true)): ?>
            <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>" enctype="multipart/form-data" class="mt-3 space-y-3">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="submit_work">
                <input type="hidden" name="assignment_id" value="<?= (int) $a['id'] ?>">
                <input type="hidden" name="project_id" value="<?= $projectId ?>">
                <div>
                    <label class="text-sm font-medium text-gray-700">Staging URL</label>
                    <input type="url" name="staging_url" placeholder="https://staging.example.com" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                </div>
                <div>
                    <label class="text-sm font-medium text-gray-700">Submission Notes</label>
                    <textarea name="developer_notes" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></textarea>
                </div>
                <div>
                    <label class="text-sm font-medium text-gray-700">Revision Proofs (PDF, images, zip — max 10MB each)</label>
                    <input type="file" name="proof_files[]" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.zip,.doc,.docx,.txt" class="w-full mt-1 text-sm">
                </div>
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Submit for Head Review</button>
            </form>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>
</div>
<?php endif; ?>

<div class="card">
    <div class="card-header flex flex-between">
        <h2>Revisions (Date-wise Record)</h2>
        <?php if ($isSeller && !in_array($project['status'], ['completed', 'refunded', 'chargeback'], true)): ?>
        <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('newRev').style.display='block'">+ Open New Revision</button>
        <?php endif; ?>
    </div>
    <?php if ($isSeller): ?>
    <div class="card-body" id="newRev" style="display:none;border-bottom:1px solid var(--border)">
        <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="open_revision">
            <input type="hidden" name="project_id" value="<?= $projectId ?>">
            <div class="form-group">
                <label>Client Feedback / Reason</label>
                <textarea name="opened_reason" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Open Revision</button>
        </form>
    </div>
    <?php endif; ?>
    <div class="card-body">
        <?php if ($revisions): ?>
        <ul class="timeline">
            <?php foreach (array_reverse($revisions) as $rev): ?>
            <li class="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-100">
                <div class="flex justify-between items-start">
                    <strong class="text-gray-900">[v<?= (int) $rev['revision_number'] ?>]</strong>
                    <?= status_badge($rev['status']) ?>
                </div>
                <?php if ($rev['opened_reason']): ?><p class="mt-2 text-sm"><span class="text-slate-500">Feedback:</span> <?= nl2br(e($rev['opened_reason'])) ?></p><?php endif; ?>
                <?php if ($rev['developer_notes']): ?><p class="text-sm"><span class="text-slate-500">Submission:</span> <?= nl2br(e($rev['developer_notes'])) ?></p><?php endif; ?>
                <?php if ($rev['resolution_note']): ?><p class="text-sm text-emerald-700"><span class="font-medium">Resolution:</span> <?= nl2br(e($rev['resolution_note'])) ?></p><?php endif; ?>
                <?php if ($rev['assignee_name']): ?><p class="text-xs text-slate-500 mt-1">Assigned: <?= e($rev['assignee_name']) ?></p><?php endif; ?>
                <?php $revFiles = $filesByRevision[$rev['id']] ?? []; if ($revFiles): ?>
                <div class="mt-2 flex flex-wrap gap-2">
                    <?php foreach ($revFiles as $f): ?>
                    <a href="<?= e(revision_file_download_url($f)) ?>" class="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-indigo-600 hover:bg-indigo-50">
                        📎 <?= e($f['original_name']) ?> <span class="text-slate-400">(<?= e($f['uploader']) ?>)</span>
                    </a>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>
                <span class="text-xs text-slate-400 block mt-2"><?= format_datetime($rev['created_at']) ?>
                    <?php if ($rev['submitted_at']): ?> · Submitted <?= format_datetime($rev['submitted_at']) ?><?php endif; ?>
                </span>
                <?php if ($isHead && $rev['status'] === 'review_pending'): ?>
                <form method="post" action="<?= e(url('project_view', ['id' => $projectId])) ?>" class="mt-3">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="head_approve">
                    <input type="hidden" name="project_id" value="<?= $projectId ?>">
                    <input type="hidden" name="revision_id" value="<?= (int) $rev['id'] ?>">
                    <button type="submit" class="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg">Approve → Client Review</button>
                </form>
                <?php endif; ?>
            </li>
            <?php endforeach; ?>
        </ul>
        <?php else: ?>
        <p class="text-muted">No revisions yet. First delivery will create revision #1 on submit.</p>
        <?php endif; ?>
    </div>
</div>

<div class="card">
    <div class="card-header"><h2>Status History</h2></div>
    <div class="card-body">
        <ul class="timeline">
            <?php foreach ($statusLog as $log): ?>
            <li>
                <?= e($log['old_status'] ?? '—') ?> → <strong><?= e($log['new_status']) ?></strong>
                <?php if ($log['note']): ?><p><?= e($log['note']) ?></p><?php endif; ?>
                <span class="time"><?= format_datetime($log['created_at']) ?> — <?= e($log['name']) ?></span>
            </li>
            <?php endforeach; ?>
        </ul>
    </div>
</div>
