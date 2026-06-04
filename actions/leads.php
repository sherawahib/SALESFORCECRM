<?php

require_roles([ROLE_ADMIN, ROLE_LEAD_FINER]);
$user = current_user();

if (!verify_csrf()) {
    flash('error', 'Invalid request.');
    redirect('index.php?page=leads');
}

$action = post_string('action');

if ($action === 'create') {
    $prefix = setting($pdo, 'lead_prefix', 'LD');
    $code = generate_code($pdo, $prefix, 'leads', 'lead_code');
    $assignMode = setting($pdo, 'assignment_mode', 'manual');
    $sellerId = post_int('assigned_seller_id') ?: null;
    if ($assignMode === 'round_robin' && !$sellerId) {
        $sellerId = null;
    }
    $status = $sellerId ? 'assigned' : 'new';

    $stmt = $pdo->prepare(
        'INSERT INTO leads (lead_code, created_by, assigned_seller_id, company_name, contact_name, email, phone, website, country, source, service_interest, budget_range, notes, status, priority, assigned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $code,
        (int) $user['id'],
        $sellerId,
        post_string('company_name') ?: null,
        post_string('contact_name'),
        post_string('email') ?: null,
        post_string('phone'),
        post_string('website') ?: null,
        post_string('country') ?: null,
        post_string('source') ?: null,
        post_string('service_interest') ?: null,
        post_string('budget_range') ?: null,
        post_string('notes') ?: null,
        $status,
        post_string('priority', 'medium'),
        $sellerId ? date('Y-m-d H:i:s') : null,
    ]);
    $leadId = (int) $pdo->lastInsertId();
    audit_log($pdo, (int) $user['id'], 'lead', $leadId, 'created');

    if ($assignMode === 'round_robin' && !$sellerId) {
        $sellerId = assign_seller_round_robin($pdo, $leadId);
    }

    if ($sellerId) {
        notify_user($pdo, $sellerId, 'lead_assigned', 'New lead assigned', "Lead {$code} has been assigned to you.", url('lead_view', ['id' => $leadId]));
    }
    flash('success', "Lead {$code} created successfully.");
}

redirect('index.php?page=leads');
