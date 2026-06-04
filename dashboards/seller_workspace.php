<?php
require_page_access('seller_workspace');
$user = current_user();
$uid = (int) $user['id'];
if ($user['role_slug'] === ROLE_ADMIN && !empty($_GET['seller_id'])) {
    $uid = (int) $_GET['seller_id'];
}

$search = trim($_GET['q'] ?? '');
$selectedId = (int) ($_GET['id'] ?? 0);
$leads = seller_queue_leads($pdo, $uid, $search !== '' ? $search : null);

$selectedLead = null;
if ($selectedId) {
    $st = $pdo->prepare('SELECT * FROM leads WHERE id = ? AND (assigned_seller_id = ? OR ? = 1)');
    $st->execute([$selectedId, $uid, $user['role_slug'] === ROLE_ADMIN ? 1 : 0]);
    $selectedLead = $st->fetch();
}
?>

<div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style="min-height: calc(100vh - 10rem);">
    <div class="grid grid-cols-1 lg:grid-cols-12 h-full min-h-[600px]">
        <div class="lg:col-span-4 border-r border-gray-200 flex flex-col">
            <div class="p-4 border-b border-gray-100 bg-gray-50">
                <label class="text-xs font-semibold text-slate-500 uppercase">Active Dialing Queue</label>
                <input type="search" name="q" placeholder="Search leads…" value="<?= e($search) ?>"
                       class="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                       hx-get="<?= e(url('api', ['action' => 'queue_search', 'seller_id' => $uid])) ?>"
                       hx-trigger="keyup changed delay:300ms"
                       hx-target="#queue-list" hx-swap="outerHTML">
            </div>
            <div class="flex-1 overflow-y-auto">
                <?php
                $leadsForPartial = $leads;
                $selectedId = $selectedId;
                require CRM_ROOT . '/components/partials/queue_list.php';
                ?>
            </div>
        </div>
        <div class="lg:col-span-8 bg-white flex flex-col" id="lead-panel-wrap">
            <?php
            $lead = $selectedLead;
            $canInvoice = true;
            require CRM_ROOT . '/components/partials/lead_panel.php';
            ?>
        </div>
    </div>
</div>
