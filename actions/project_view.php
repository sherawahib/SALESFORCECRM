<?php

$user = require_login();
if (!verify_csrf()) {
    flash('error', 'Invalid request.');
    redirect('index.php?page=projects');
}

$projectId = post_int('project_id');
$action = post_string('action');

$stmt = $pdo->prepare('SELECT * FROM projects WHERE id = ?');
$stmt->execute([$projectId]);
$project = $stmt->fetch();
if (!$project) {
    flash('error', 'Project not found.');
    redirect('index.php?page=projects');
}

if (!empty($project['is_frozen']) && !in_array($action, ['financial_status'], true) && $user['role_slug'] !== ROLE_ADMIN) {
    flash('error', 'Project is frozen (chargeback).');
    redirect('index.php?page=project_view&id=' . $projectId);
}

$uid = (int) $user['id'];
$oldStatus = $project['status'];

switch ($action) {
    case 'assign':
        require_roles([ROLE_ADMIN, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD]);
        $assigneeId = post_int('assignee_id');
        $instructions = post_string('instructions');
        if ($instructions === '') {
            flash('error', 'Instructions required.');
            break;
        }
        $pdo->prepare(
            'INSERT INTO project_assignments (project_id, assigned_by, assignee_id, instructions, staging_url, due_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $projectId, $uid, $assigneeId, $instructions,
            post_string('staging_url') ?: null,
            post_string('due_date') ?: null,
            'assigned',
        ]);

        $pdo->prepare("UPDATE projects SET status = 'in_progress', head_user_id = COALESCE(head_user_id, ?), seller_brief = COALESCE(seller_brief, ?) WHERE id = ?")
            ->execute([$uid, post_string('seller_brief') ?: null, $projectId]);
        log_project_status($pdo, $projectId, $uid, 'in_progress', $oldStatus, 'Task assigned');

        notify_user($pdo, $assigneeId, 'assignment', 'New task assigned', $instructions, url('project_view', ['id' => $projectId]));
        flash('success', 'Team member assigned.');
        break;

    case 'submit_work':
        require_roles([ROLE_ADMIN, ROLE_DESIGNER, ROLE_DEVELOPER]);
        $assignmentId = post_int('assignment_id');
        $notes = post_string('developer_notes');
        $staging = post_string('staging_url');

        $pdo->prepare("UPDATE project_assignments SET status = 'review_pending', submitted_at = NOW(), proof_notes = ?, staging_url = COALESCE(?, staging_url) WHERE id = ? AND assignee_id = ?")
            ->execute([$notes ?: null, $staging ?: null, $assignmentId, $uid]);

        $revNum = next_revision_number($pdo, $projectId);
        $pdo->prepare(
            'INSERT INTO project_revisions (project_id, revision_number, opened_by, assignee_id, developer_notes, status, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())'
        )->execute([$projectId, $revNum, $uid, $uid, $notes ?: null, 'review_pending']);
        $revisionId = (int) $pdo->lastInsertId();

        if (!empty($_FILES['proof_files'])) {
            $uploaded = upload_revision_files($pdo, $user, $projectId, $revisionId, $assignmentId, $_FILES['proof_files']);
            if ($uploaded) {
                $notes .= "\n[Attachments: " . count($uploaded) . " file(s)]";
            }
        }

        $pdo->prepare("UPDATE projects SET status = 'review_pending' WHERE id = ?")->execute([$projectId]);
        log_project_status($pdo, $projectId, $uid, 'review_pending', $oldStatus, "Revision v{$revNum} pending head review");

        if ($project['head_user_id']) {
            notify_user($pdo, (int) $project['head_user_id'], 'head_review', 'Submission needs approval', "Revision v{$revNum} ready for internal review.", url('project_view', ['id' => $projectId]));
        }
        flash('success', 'Submitted for department head review.');
        break;

    case 'head_approve':
        require_roles([ROLE_ADMIN, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD]);
        $revisionId = post_int('revision_id');
        $pdo->prepare("UPDATE project_revisions SET status = 'client_review', head_approved_at = NOW(), head_approved_by = ?, notify_seller = 1 WHERE id = ? AND project_id = ?")
            ->execute([$uid, $revisionId, $projectId]);
        $pdo->prepare("UPDATE projects SET status = 'client_review' WHERE id = ?")->execute([$projectId]);
        log_project_status($pdo, $projectId, $uid, 'client_review', $oldStatus, 'Head approved — seller to notify client');

        notify_user($pdo, (int) $project['seller_id'], 'client_review', 'Deliver to client', 'Internal QA passed. Notify your client.', url('project_view', ['id' => $projectId]));
        flash('success', 'Approved. Seller alerted to contact client.');
        break;

    case 'seller_notified':
        require_roles([ROLE_ADMIN, ROLE_SELLER]);
        $revisionId = post_int('revision_id');
        $pdo->prepare('UPDATE project_revisions SET seller_notified_at = NOW(), notify_seller = 0 WHERE id = ? AND project_id = ?')
            ->execute([$revisionId, $projectId]);
        flash('success', 'Marked as client notified.');
        break;

    case 'open_revision':
        require_roles([ROLE_ADMIN, ROLE_SELLER]);
        $reason = post_string('opened_reason');
        $revNum = next_revision_number($pdo, $projectId);

        $lastAssignee = $pdo->prepare('SELECT assignee_id FROM project_assignments WHERE project_id = ? ORDER BY id DESC LIMIT 1');
        $lastAssignee->execute([$projectId]);
        $assigneeId = (int) ($lastAssignee->fetchColumn() ?: 0);

        $pdo->prepare(
            'INSERT INTO project_revisions (project_id, revision_number, opened_by, opened_reason, assignee_id, status)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([$projectId, $revNum, $uid, $reason, $assigneeId ?: null, 'open_revision']);

        $pdo->prepare("UPDATE projects SET status = 'open_revision' WHERE id = ?")->execute([$projectId]);
        if ($assigneeId) {
            $pdo->prepare("UPDATE project_assignments SET status = 'in_progress' WHERE project_id = ? AND assignee_id = ? ORDER BY id DESC LIMIT 1")
                ->execute([$projectId, $assigneeId]);
            notify_user($pdo, $assigneeId, 'open_revision', "Revision v{$revNum} opened", $reason, url('project_view', ['id' => $projectId]));
        }
        if ($project['head_user_id']) {
            notify_user($pdo, (int) $project['head_user_id'], 'revision_opened', 'Client revision', $reason, url('project_view', ['id' => $projectId]));
        }
        log_project_status($pdo, $projectId, $uid, 'open_revision', $oldStatus, $reason);
        flash('success', "Revision v{$revNum} opened and routed to production.");
        break;

    case 'resolve_revision':
        require_roles([ROLE_ADMIN, ROLE_SELLER, ROLE_DESIGN_HEAD, ROLE_DEV_HEAD]);
        $revisionId = post_int('revision_id');
        $note = post_string('resolution_note');
        $pdo->prepare("UPDATE project_revisions SET status = 'resolved', resolution_note = ?, closed_at = NOW() WHERE id = ?")
            ->execute([$note, $revisionId]);
        flash('success', 'Revision marked resolved.');
        break;

    case 'upsell':
        require_roles([ROLE_ADMIN, ROLE_SELLER]);
        $desc = post_string('description');
        $amount = post_float('amount');
        $markPaid = !empty($_POST['mark_upsell_paid']);

        $invNum = generate_code($pdo, setting($pdo, 'invoice_prefix', 'INV'), 'invoices', 'invoice_number');
        $pcStmt = $pdo->prepare('SELECT project_category FROM invoices WHERE id = ?');
        $pcStmt->execute([(int) $project['invoice_id']]);
        $projCat = $pcStmt->fetchColumn() ?: 'development';
        $pdo->prepare(
            'INSERT INTO invoices (invoice_number, parent_project_id, client_id, seller_id, service_category_id, project_category, subtotal, tax_amount, discount, total, amount_paid, status, is_upsell, paid_at, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 1, ?, ?)'
        )->execute([
            $invNum,
            $projectId,
            $project['client_id'],
            $project['seller_id'],
            $project['service_category_id'],
            $projCat,
            $amount,
            $amount,
            $markPaid ? $amount : 0,
            $markPaid ? 'paid' : 'unpaid',
            $markPaid ? date('Y-m-d H:i:s') : null,
            $desc,
        ]);
        $subInvId = (int) $pdo->lastInsertId();

        $pdo->prepare(
            'INSERT INTO project_budget_lines (project_id, line_type, description, amount, invoice_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([$projectId, 'upsell', $desc, $amount, $subInvId, $uid]);

        recalculate_project_budget($pdo, $projectId);
        audit_log($pdo, $uid, 'project', $projectId, 'upsell_invoice', ['invoice' => $invNum, 'amount' => $amount]);
        flash('success', $markPaid ? 'Upsell invoiced and added to budget.' : 'Upsell sub-invoice created (unpaid).');
        break;

    case 'financial_status':
        require_roles([ROLE_ADMIN, ROLE_SELLER]);
        $fin = post_string('financial_status');
        if ($fin === 'chargeback') {
            freeze_project_chargeback($pdo, $projectId, $uid);
            flash('success', 'Chargeback recorded. Production frozen. Admins alerted.');
            break;
        }
        if ($fin === 'refunded') {
            $pdo->prepare("UPDATE projects SET status = 'refunded' WHERE id = ?")->execute([$projectId]);
            $pdo->prepare("UPDATE invoices SET status = 'refunded' WHERE id = ?")->execute([$project['invoice_id']]);
            log_project_status($pdo, $projectId, $uid, 'refunded', $oldStatus, 'Refund');
            if ($project['head_user_id']) {
                notify_user($pdo, (int) $project['head_user_id'], 'refunded', 'Project refunded', 'Production halted.', url('project_view', ['id' => $projectId]));
            }
            flash('success', 'Refund status applied.');
        }
        break;

    case 'close_project':
        require_roles([ROLE_ADMIN, ROLE_SELLER]);
        $pdo->prepare("UPDATE projects SET status = 'completed', completed_at = NOW(), closed_by = ? WHERE id = ?")
            ->execute([$uid, $projectId]);
        $pdo->prepare("UPDATE project_revisions SET status = 'closed', closed_at = NOW() WHERE project_id = ? AND status NOT IN ('closed','resolved')")
            ->execute([$projectId]);
        log_project_status($pdo, $projectId, $uid, 'completed', $oldStatus, 'Project closed');
        flash('success', 'Project archived as complete.');
        break;
}

redirect('index.php?page=project_view&id=' . $projectId);
