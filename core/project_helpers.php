<?php

declare(strict_types=1);

function recalculate_project_budget(PDO $pdo, int $projectId): void
{
    $stmt = $pdo->prepare('SELECT invoice_id FROM projects WHERE id = ?');
    $stmt->execute([$projectId]);
    $row = $stmt->fetch();
    if (!$row) {
        return;
    }

    $inv = $pdo->prepare('SELECT total, amount_paid, status FROM invoices WHERE id = ?');
    $inv->execute([(int) $row['invoice_id']]);
    $base = $inv->fetch();
    $baseAmount = ($base && $base['status'] === 'paid') ? (float) $base['total'] : (float) ($base['amount_paid'] ?? 0);

    $upsellStmt = $pdo->prepare(
        "SELECT COALESCE(SUM(amount_paid), 0) FROM invoices
         WHERE parent_project_id = ? AND is_upsell = 1 AND status IN ('paid','partial')"
    );
    $upsellStmt->execute([$projectId]);
    $upsellPaid = (float) $upsellStmt->fetchColumn();

    $partialUpsell = $pdo->prepare(
        "SELECT COALESCE(SUM(amount_paid), 0) FROM invoices WHERE parent_project_id = ? AND is_upsell = 1 AND status = 'partial'"
    );
    $partialUpsell->execute([$projectId]);
    $upsellPaid += (float) $partialUpsell->fetchColumn();

    $total = $baseAmount + $upsellPaid;
    $pdo->prepare('UPDATE projects SET budget_total = ? WHERE id = ?')->execute([$total, $projectId]);
}

function create_projects_from_paid_invoice(PDO $pdo, int $invoiceId, int $sellerId): void
{
    $stmt = $pdo->prepare(
        'SELECT i.*, sc.department_id, sc.name AS category_name, sc.slug AS cat_slug, c.contact_name
         FROM invoices i
         JOIN service_categories sc ON sc.id = i.service_category_id
         JOIN clients c ON c.id = i.client_id
         WHERE i.id = ?'
    );
    $stmt->execute([$invoiceId]);
    $inv = $stmt->fetch();
    if (!$inv || $inv['status'] !== 'paid') {
        return;
    }

    $check = $pdo->prepare('SELECT id FROM projects WHERE invoice_id = ? LIMIT 1');
    $check->execute([$invoiceId]);
    if ($check->fetch()) {
        return;
    }

    $category = $inv['project_category'] ?? 'development';
    $comboGroup = $category === 'combo' ? bin2hex(random_bytes(16)) : null;
    $brief = $inv['notes'] ?? '';

    $deptMap = [
        'design' => ['design', 'Design'],
        'development' => ['development', 'Development'],
        'combo' => [['design', 'Design Component'], ['development', 'Development Component']],
    ];

    $toCreate = [];
    if ($category === 'combo') {
        $toCreate = $deptMap['combo'];
    } else {
        $toCreate = [[$deptMap[$category][0], $deptMap[$category][1] ?? ucfirst($category)]];
    }

    $prefix = setting($pdo, 'project_prefix', 'PRJ');
    foreach ($toCreate as [$deptSlug, $label]) {
        $dept = $pdo->prepare('SELECT id FROM departments WHERE slug = ?');
        $dept->execute([$deptSlug]);
        $deptId = (int) $dept->fetchColumn();
        if (!$deptId) {
            continue;
        }

        $code = generate_code($pdo, $prefix, 'projects', 'project_code');
        $heads = department_heads($pdo, $deptId);
        $headId = $heads[0]['id'] ?? null;
        $title = ($category === 'combo' ? $label . ' — ' : $inv['category_name'] . ' — ') . $inv['contact_name'];

        $pdo->prepare(
            'INSERT INTO projects (project_code, combo_group_id, invoice_id, client_id, seller_id, service_category_id, department_id, head_user_id, title, seller_brief, status, budget_total, started_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        )->execute([
            $code,
            $comboGroup,
            $invoiceId,
            $inv['client_id'],
            $sellerId,
            $inv['service_category_id'],
            $deptId,
            $headId,
            $title,
            $brief,
            'pending_assignment',
            (float) $inv['total'] / count($toCreate),
        ]);
        $projectId = (int) $pdo->lastInsertId();

        if ($category !== 'combo' || $deptSlug === 'design') {
            $pdo->prepare(
                'INSERT INTO project_budget_lines (project_id, line_type, description, amount, invoice_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([$projectId, 'original', 'Original contract', $inv['total'], $invoiceId, $sellerId]);
        }

        log_project_status($pdo, $projectId, $sellerId, 'pending_assignment', null, 'Auto-routed from paid invoice');
        if ($headId) {
            notify_user($pdo, (int) $headId, 'project_new', 'New project in queue', "Project {$code} requires assignment.", url('project_view', ['id' => $projectId]));
        }
    }
    $first = $pdo->prepare('SELECT id FROM projects WHERE invoice_id = ? ORDER BY id LIMIT 1');
    $first->execute([$invoiceId]);
    $fid = $first->fetchColumn();
    if ($fid) {
        recalculate_project_budget($pdo, (int) $fid);
    }
}

function freeze_project_chargeback(PDO $pdo, int $projectId, int $userId): void
{
    $pdo->prepare("UPDATE projects SET is_frozen = 1, status = 'chargeback' WHERE id = ?")->execute([$projectId]);
    $proj = $pdo->prepare('SELECT invoice_id, project_code FROM projects WHERE id = ?');
    $proj->execute([$projectId]);
    $p = $proj->fetch();
    if ($p) {
        $pdo->prepare("UPDATE invoices SET status = 'chargeback' WHERE id = ?")->execute([$p['invoice_id']]);
    }
    log_project_status($pdo, $projectId, $userId, 'chargeback', null, 'Chargeback — production frozen');
    notify_admins($pdo, 'chargeback', 'URGENT: Chargeback', 'Project ' . ($p['project_code'] ?? $projectId) . ' frozen.', url('project_view', ['id' => $projectId]));
}

function log_project_status(PDO $pdo, int $projectId, int $userId, string $newStatus, ?string $oldStatus = null, ?string $note = null): void
{
    $pdo->prepare(
        'INSERT INTO project_status_log (project_id, user_id, old_status, new_status, note) VALUES (?, ?, ?, ?, ?)'
    )->execute([$projectId, $userId, $oldStatus, $newStatus, $note]);
}

function next_revision_number(PDO $pdo, int $projectId): int
{
    $stmt = $pdo->prepare('SELECT COALESCE(MAX(revision_number), 0) + 1 FROM project_revisions WHERE project_id = ?');
    $stmt->execute([$projectId]);
    return (int) $stmt->fetchColumn();
}

/** @deprecated use create_projects_from_paid_invoice */
function create_project_from_invoice(PDO $pdo, int $invoiceId, int $sellerId): void
{
    create_projects_from_paid_invoice($pdo, $invoiceId, $sellerId);
}

function update_project_budget_total(PDO $pdo, int $projectId): void
{
    recalculate_project_budget($pdo, $projectId);
}
