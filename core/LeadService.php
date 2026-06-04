<?php

declare(strict_types=1);

function assign_seller_round_robin(PDO $pdo, int $leadId): ?int
{
    $sellers = users_by_role($pdo, ROLE_SELLER);
    if (!$sellers) {
        return null;
    }
    $lastId = (int) setting($pdo, 'round_robin_last_seller_id', '0');
    $next = null;
    $found = false;
    foreach ($sellers as $s) {
        if ($found || $lastId === 0) {
            $next = (int) $s['id'];
            break;
        }
        if ((int) $s['id'] === $lastId) {
            $found = true;
        }
    }
    if ($next === null) {
        $next = (int) $sellers[0]['id'];
    }

    $pdo->prepare('UPDATE leads SET assigned_seller_id = ?, status = ?, assigned_at = NOW() WHERE id = ?')
        ->execute([$next, 'assigned', $leadId]);
    $pdo->prepare('UPDATE settings SET setting_value = ? WHERE setting_key = ?')
        ->execute([(string) $next, 'round_robin_last_seller_id']);

    notify_user($pdo, $next, 'lead_assigned', 'New lead (round-robin)', 'A lead was auto-assigned to you.', url('seller_workspace', ['id' => $leadId]));
    return $next;
}

function seller_queue_leads(PDO $pdo, int $sellerId, ?string $search = null): array
{
    $sql = "SELECT l.* FROM leads l
            WHERE l.assigned_seller_id = ? AND l.is_archived = 0 AND l.status NOT IN ('won','lost','archived')
            AND (l.callback_at IS NULL OR l.callback_at <= NOW())";
    $params = [$sellerId];
    if ($search) {
        $sql .= " AND (l.contact_name LIKE ? OR l.company_name LIKE ? OR l.phone LIKE ? OR l.lead_code LIKE ?)";
        $q = '%' . $search . '%';
        $params = array_merge($params, [$q, $q, $q, $q]);
    }
    $sql .= " ORDER BY FIELD(l.queue_tier,'hot','new','cold'),
              FIELD(l.priority,'urgent','high','medium','low'),
              l.follow_up_at ASC, l.updated_at DESC LIMIT 80";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function log_quick_call(PDO $pdo, array $user, int $leadId, string $outcome, ?string $callbackAt = null): void
{
    $stmt = $pdo->prepare('SELECT * FROM leads WHERE id = ? AND assigned_seller_id = ?');
    $stmt->execute([$leadId, (int) $user['id']]);
    $lead = $stmt->fetch();
    if (!$lead && $user['role_slug'] !== ROLE_ADMIN) {
        return;
    }

    $summary = 'Quick log: ' . str_replace('_', ' ', $outcome);
    $pdo->prepare(
        'INSERT INTO conversations (lead_id, seller_id, channel, outcome, summary, next_follow_up) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $leadId,
        (int) $user['id'],
        'call',
        $outcome,
        $summary,
        $callbackAt ? date('Y-m-d', strtotime($callbackAt)) : null,
    ]);

    $tier = $lead['queue_tier'] ?? 'new';
    $status = $lead['status'];
    switch ($outcome) {
        case 'no_answer':
        case 'voicemail':
            $tier = 'cold';
            $pdo->prepare('UPDATE leads SET queue_tier = ?, follow_up_at = DATE_ADD(NOW(), INTERVAL 1 DAY), status = IF(status="new","assigned",status) WHERE id = ?')
                ->execute([$tier, $leadId]);
            break;
        case 'not_interested':
            $pdo->prepare("UPDATE leads SET status = 'lost', is_archived = 1 WHERE id = ?")->execute([$leadId]);
            break;
        case 'callback_scheduled':
            $pdo->prepare('UPDATE leads SET callback_at = ?, queue_tier = ?, status = ? WHERE id = ?')
                ->execute([$callbackAt, 'hot', 'contacted', $leadId]);
            break;
        case 'ready_to_buy':
            $pdo->prepare("UPDATE leads SET status = 'won', queue_tier = 'hot', won_at = NOW() WHERE id = ?")->execute([$leadId]);
            break;
        default:
            $pdo->prepare("UPDATE leads SET status = 'contacted' WHERE id = ?")->execute([$leadId]);
    }

    audit_log($pdo, (int) $user['id'], 'lead', $leadId, 'quick_call', ['outcome' => $outcome]);
}
