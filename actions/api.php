<?php

declare(strict_types=1);

$user = require_login();
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !verify_csrf()) {
    http_response_code(403);
    echo '<p class="text-red-600 p-4">Session expired. Refresh the page.</p>';
    exit;
}

$action = $_GET['action'] ?? post_string('action');
$uid = (int) $user['id'];
if ($user['role_slug'] === ROLE_ADMIN && !empty($_REQUEST['seller_id'])) {
    $uid = (int) $_REQUEST['seller_id'];
}

switch ($action) {
    case 'lead_panel':
        $leadId = (int) ($_GET['id'] ?? 0);
        $st = $pdo->prepare('SELECT * FROM leads WHERE id = ?');
        $st->execute([$leadId]);
        $lead = $st->fetch();
        if ($lead && $user['role_slug'] === ROLE_SELLER && (int) $lead['assigned_seller_id'] !== $uid) {
            $lead = null;
        }
        $canInvoice = true;
        require CRM_ROOT . '/components/partials/lead_panel.php';
        exit;

    case 'queue_search':
        $search = trim($_GET['q'] ?? '');
        $leads = seller_queue_leads($pdo, $uid, $search !== '' ? $search : null);
        $selectedId = (int) ($_GET['id'] ?? 0);
        require CRM_ROOT . '/components/partials/queue_list.php';
        exit;

    case 'quick_call':
        require_roles([ROLE_ADMIN, ROLE_SELLER]);
        $leadId = post_int('lead_id');
        $outcome = post_string('outcome');
        $callbackAt = post_string('callback_at') ?: null;
        log_quick_call($pdo, $user, $leadId, $outcome, $callbackAt);

        if ($outcome === 'not_interested') {
            $leads = seller_queue_leads($pdo, $uid);
            $selectedId = 0;
            require CRM_ROOT . '/components/partials/queue_list.php';
            exit;
        }

        $st = $pdo->prepare('SELECT * FROM leads WHERE id = ?');
        $st->execute([$leadId]);
        $lead = $st->fetch();
        $canInvoice = true;
        header('HX-Trigger: leadUpdated');
        require CRM_ROOT . '/components/partials/lead_panel.php';
        exit;
}

http_response_code(404);
echo 'Unknown action';
