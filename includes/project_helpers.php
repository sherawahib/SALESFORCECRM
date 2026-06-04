<?php

declare(strict_types=1);

function create_project_from_invoice(PDO $pdo, int $invoiceId, int $sellerId): void
{
    $stmt = $pdo->prepare(
        'SELECT i.*, sc.department_id, sc.name AS category_name, c.contact_name
         FROM invoices i
         JOIN service_categories sc ON sc.id = i.service_category_id
         JOIN clients c ON c.id = i.client_id
         WHERE i.id = ?'
    );
    $stmt->execute([$invoiceId]);
    $inv = $stmt->fetch();
    if (!$inv) {
        return;
    }

    $existing = $pdo->prepare('SELECT id FROM projects WHERE invoice_id = ?');
    $existing->execute([$invoiceId]);
    if ($existing->fetch()) {
        return;
    }

    $prefix = setting($pdo, 'project_prefix', 'PRJ');
    $code = generate_code($pdo, $prefix, 'projects', 'project_code');
    $title = $inv['category_name'] . ' — ' . $inv['contact_name'];

    $heads = department_heads($pdo, (int) $inv['department_id']);
    $headId = $heads[0]['id'] ?? null;

    $pdo->prepare(
        'INSERT INTO projects (project_code, invoice_id, client_id, seller_id, service_category_id, department_id, head_user_id, title, status, budget_total, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    )->execute([
        $code,
        $invoiceId,
        $inv['client_id'],
        $sellerId,
        $inv['service_category_id'],
        $inv['department_id'],
        $headId,
        $title,
        'pending_assignment',
        $inv['total'],
    ]);
    $projectId = (int) $pdo->lastInsertId();

    $pdo->prepare(
        'INSERT INTO project_budget_lines (project_id, line_type, description, amount, invoice_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$projectId, 'original', 'Original contract', $inv['total'], $invoiceId, $sellerId]);

    log_project_status($pdo, $projectId, $sellerId, 'pending_assignment', null, 'Project created from paid invoice');

    if ($headId) {
        notify_user(
            $pdo,
            (int) $headId,
            'project_new',
            'New project in queue',
            "Project {$code} requires assignment.",
            url('project_view', ['id' => $projectId])
        );
    }
}

function update_project_budget_total(PDO $pdo, int $projectId): void
{
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(CASE WHEN line_type = 'refund' THEN -ABS(amount) ELSE amount END), 0)
         FROM project_budget_lines WHERE project_id = ?"
    );
    $stmt->execute([$projectId]);
    $total = (float) $stmt->fetchColumn();
    $pdo->prepare('UPDATE projects SET budget_total = ? WHERE id = ?')->execute([$total, $projectId]);
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
