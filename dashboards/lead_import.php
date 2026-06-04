<?php
require_page_access('lead_import');
$user = current_user();
$sellers = users_by_role($pdo, ROLE_SELLER);
$assignmentMode = setting($pdo, 'assignment_mode', 'manual');
?>

<div class="max-w-3xl">
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-900">Bulk CSV Lead Import</h2>
        <p class="text-sm text-slate-500 mt-1">Map columns: company_name, contact_name, email, phone, source, notes (header row required).</p>

        <form method="post" action="<?= e(url('lead_import')) ?>" enctype="multipart/form-data" class="mt-6 space-y-4">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="csv_import">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
                <input type="file" name="csv_file" accept=".csv,text/csv" required
                       class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Assign leads to</label>
                <select name="assign_mode" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="manual">Manual — select seller below</option>
                    <option value="round_robin" <?= $assignmentMode === 'round_robin' ? 'selected' : '' ?>>Round-robin queue</option>
                    <option value="unassigned">Leave unassigned</option>
                </select>
            </div>
            <div id="sellerPick">
                <label class="block text-sm font-medium text-gray-700 mb-1">Seller</label>
                <select name="assigned_seller_id" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">—</option>
                    <?php foreach ($sellers as $s): ?>
                    <option value="<?= (int) $s['id'] ?>"><?= e($s['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Upload & Import</button>
        </form>
    </div>

    <?php
    $batches = $pdo->prepare(
        'SELECT b.*, u.name FROM lead_import_batches b JOIN users u ON u.id = b.uploaded_by WHERE b.uploaded_by = ? OR ? = 1 ORDER BY b.created_at DESC LIMIT 20'
    );
    $batches->execute([(int) $user['id'], $user['role_slug'] === ROLE_ADMIN ? 1 : 0]);
    $batches = $batches->fetchAll();
    if ($batches):
    ?>
    <div class="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-slate-500 uppercase text-xs">
                <tr><th class="px-4 py-3">File</th><th class="px-4 py-3">Rows</th><th class="px-4 py-3">Imported</th><th class="px-4 py-3">Date</th></tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                <?php foreach ($batches as $b): ?>
                <tr><td class="px-4 py-3"><?= e($b['filename']) ?></td><td class="px-4 py-3"><?= (int) $b['row_count'] ?></td><td class="px-4 py-3"><?= (int) $b['success_count'] ?></td><td class="px-4 py-3"><?= format_datetime($b['created_at']) ?></td></tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>
