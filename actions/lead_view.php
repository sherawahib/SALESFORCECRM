<?php

$user = require_roles([ROLE_ADMIN, ROLE_LEAD_FINER, ROLE_SELLER]);
if (!verify_csrf()) {
    flash('error', 'Invalid request.');
    redirect('index.php?page=my_leads');
}

$leadId = post_int('lead_id');
$action = post_string('action');

if ($action === 'conversation' && $leadId) {
    $outcome = post_string('outcome');
    $summary = post_string('summary');
    if ($summary === '') {
        flash('error', 'Summary is required.');
        redirect('index.php?page=lead_view&id=' . $leadId);
    }

    $pdo->prepare(
        'INSERT INTO conversations (lead_id, seller_id, channel, outcome, summary, next_follow_up) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $leadId,
        (int) $user['id'],
        post_string('channel', 'call'),
        $outcome,
        $summary,
        post_string('next_follow_up') ?: null,
    ]);

    $newStatus = post_string('lead_status');
    if ($newStatus !== '') {
        $pdo->prepare('UPDATE leads SET status = ?, won_at = IF(? = "won", NOW(), won_at) WHERE id = ?')
            ->execute([$newStatus, $newStatus, $leadId]);
    } elseif ($outcome === 'ready_to_buy') {
        $pdo->prepare("UPDATE leads SET status = 'won', won_at = NOW() WHERE id = ?")->execute([$leadId]);
    } elseif ($outcome === 'not_interested') {
        $pdo->prepare("UPDATE leads SET status = 'lost' WHERE id = ?")->execute([$leadId]);
    } else {
        $pdo->prepare("UPDATE leads SET status = 'contacted' WHERE id = ? AND status = 'assigned'")->execute([$leadId]);
    }

    $pdo->prepare(
        'INSERT INTO lead_activities (lead_id, user_id, activity_type, subject, body) VALUES (?, ?, ?, ?, ?)'
    )->execute([$leadId, (int) $user['id'], 'call', 'Conversation logged', $summary]);

    audit_log($pdo, (int) $user['id'], 'lead', $leadId, 'conversation', ['outcome' => $outcome]);
    flash('success', 'Client response recorded.');
}

redirect('index.php?page=lead_view&id=' . $leadId);
