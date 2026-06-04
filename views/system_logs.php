<?php
require_page_access('system_logs');

$logs = $pdo->query(
    'SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 150'
)->fetchAll();
$emails = [];
try {
    $emails = $pdo->query('SELECT e.*, u.name AS user_name FROM email_log e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 80')->fetchAll();
} catch (Throwable $e) {
}
?>

<div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
    <div class="px-5 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-900">Email Log</h2>
    </div>
    <?php if ($emails): ?>
    <div class="overflow-x-auto max-h-64 overflow-y-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs text-slate-500 uppercase"><tr><th class="px-4 py-2">Time</th><th class="px-4 py-2">To</th><th class="px-4 py-2">Subject</th><th class="px-4 py-2">Status</th></tr></thead>
            <tbody class="divide-y divide-gray-100">
                <?php foreach ($emails as $em): ?>
                <tr><td class="px-4 py-2 whitespace-nowrap"><?= format_datetime($em['created_at']) ?></td><td class="px-4 py-2"><?= e($em['to_email']) ?></td><td class="px-4 py-2"><?= e($em['subject']) ?></td><td class="px-4 py-2"><?= status_badge($em['status']) ?></td></tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
    <p class="px-5 py-4 text-sm text-slate-400">No emails logged yet. Run migration 003 if this section is missing.</p>
    <?php endif; ?>
</div>

<div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-900">System Audit Log</h2>
    </div>
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                    <th class="px-4 py-3">Time</th>
                    <th class="px-4 py-3">User</th>
                    <th class="px-4 py-3">Entity</th>
                    <th class="px-4 py-3">Action</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                <?php foreach ($logs as $log): ?>
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 whitespace-nowrap"><?= format_datetime($log['created_at']) ?></td>
                    <td class="px-4 py-3"><?= e($log['user_name'] ?? 'System') ?></td>
                    <td class="px-4 py-3"><?= e($log['entity_type']) ?> #<?= (int) $log['entity_id'] ?></td>
                    <td class="px-4 py-3"><?= e($log['action']) ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
