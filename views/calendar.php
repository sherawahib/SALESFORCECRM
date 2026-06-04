<?php
require_page_access('calendar');
$user = current_user();
$uid = (int) $user['id'];

$stmt = $pdo->prepare(
    "SELECT l.id, l.lead_code, l.contact_name, l.callback_at, l.company_name
     FROM leads l
     WHERE l.assigned_seller_id = ? AND l.callback_at IS NOT NULL AND l.callback_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY l.callback_at ASC"
);
$stmt->execute([$uid]);
$callbacks = $stmt->fetchAll();
?>

<div class="bg-white rounded-xl border border-gray-200 shadow-sm">
    <div class="px-5 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-900">Callback Calendar</h2>
        <p class="text-sm text-slate-500">Scheduled follow-ups from your dialing workspace</p>
    </div>
    <ul class="divide-y divide-gray-100">
        <?php foreach ($callbacks as $c): ?>
        <li class="px-5 py-4 flex justify-between items-center hover:bg-gray-50">
            <div>
                <p class="font-medium text-gray-900"><?= e($c['contact_name']) ?> — <?= e($c['company_name'] ?? '') ?></p>
                <p class="text-xs text-slate-500"><?= e($c['lead_code']) ?></p>
            </div>
            <div class="text-right">
                <p class="text-sm font-semibold text-amber-700"><?= format_datetime($c['callback_at']) ?></p>
                <a href="<?= e(url('seller_workspace', ['id' => $c['id']])) ?>" class="text-xs text-indigo-600">Open workspace →</a>
            </div>
        </li>
        <?php endforeach; ?>
        <?php if (!$callbacks): ?>
        <li class="px-5 py-8 text-center text-slate-400 text-sm">No callbacks scheduled.</li>
        <?php endif; ?>
    </ul>
</div>
