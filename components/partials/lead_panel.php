<?php
/** @var array|null $lead */
/** @var bool $canInvoice */
if (!$lead): ?>
<div class="flex items-center justify-center h-full text-slate-400 text-sm p-8 text-center">
    Select a lead from the queue to view details and log call outcomes.
</div>
<?php return; endif;

$canInvoice = in_array($lead['status'], ['qualified', 'won', 'contacted'], true);
?>
<div id="lead-panel" class="p-5 space-y-4">
    <div>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead <?= e($lead['lead_code']) ?></p>
        <h2 class="text-xl font-bold text-gray-900 mt-1"><?= e($lead['contact_name']) ?></h2>
        <p class="text-slate-600"><?= e($lead['company_name'] ?? 'No company') ?></p>
        <div class="flex gap-2 mt-2"><?= status_badge($lead['queue_tier'] ?? 'new') ?> <?= status_badge($lead['status']) ?></div>
    </div>
    <dl class="grid grid-cols-1 gap-3 text-sm border-t border-gray-100 pt-4">
        <div><dt class="text-slate-500">Phone</dt><dd class="font-medium"><a href="tel:<?= e(preg_replace('/\s+/', '', $lead['phone'] ?? '')) ?>" class="text-indigo-600"><?= e($lead['phone'] ?? '—') ?></a></dd></div>
        <div><dt class="text-slate-500">Email</dt><dd class="font-medium"><a href="mailto:<?= e($lead['email'] ?? '') ?>" class="text-indigo-600"><?= e($lead['email'] ?? '—') ?></a></dd></div>
        <div><dt class="text-slate-500">Interest</dt><dd><?= e($lead['service_interest'] ?? '—') ?></dd></div>
        <div><dt class="text-slate-500">Budget</dt><dd><?= e($lead['budget_range'] ?? '—') ?></dd></div>
        <?php if (!empty($lead['callback_at'])): ?>
        <div><dt class="text-slate-500">Callback</dt><dd class="text-amber-700 font-medium"><?= format_datetime($lead['callback_at']) ?></dd></div>
        <?php endif; ?>
        <?php if (!empty($lead['notes'])): ?>
        <div><dt class="text-slate-500">Notes</dt><dd class="text-gray-700"><?= nl2br(e($lead['notes'])) ?></dd></div>
        <?php endif; ?>
    </dl>

    <div class="border-t border-gray-100 pt-4">
        <p class="text-xs font-semibold text-slate-500 uppercase mb-3">Call Outcome (instant log)</p>
        <div class="grid grid-cols-2 gap-2">
            <button type="button" class="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 font-medium"
                    hx-post="<?= e(url('api')) ?>" hx-vals='{"action":"quick_call","lead_id":"<?= (int) $lead['id'] ?>","outcome":"no_answer"}'
                    hx-target="#lead-panel" hx-swap="outerHTML">No Answer</button>
            <button type="button" class="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 font-medium"
                    hx-post="<?= e(url('api')) ?>" hx-vals='{"action":"quick_call","lead_id":"<?= (int) $lead['id'] ?>","outcome":"voicemail"}'
                    hx-target="#lead-panel" hx-swap="outerHTML">Voicemail</button>
            <button type="button" class="px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium col-span-2"
                    hx-post="<?= e(url('api')) ?>" hx-vals='{"action":"quick_call","lead_id":"<?= (int) $lead['id'] ?>","outcome":"not_interested"}'
                    hx-target="#queue-list" hx-swap="outerHTML" hx-on::after-request="document.getElementById('lead-panel').innerHTML=''">Not Interested</button>
        </div>
        <div class="mt-3" x-data="{ showCallback: false }">
            <button type="button" @click="showCallback = !showCallback" class="w-full px-3 py-2 text-sm rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium">Set Callback</button>
            <form x-show="showCallback" class="mt-2 flex gap-2" hx-post="<?= e(url('api')) ?>"
                  hx-target="#lead-panel" hx-swap="outerHTML">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="quick_call">
                <input type="hidden" name="lead_id" value="<?= (int) $lead['id'] ?>">
                <input type="hidden" name="outcome" value="callback_scheduled">
                <input type="datetime-local" name="callback_at" required class="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                <button type="submit" class="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg">Save</button>
            </form>
        </div>
        <button type="button" class="w-full mt-2 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                hx-post="<?= e(url('api')) ?>" hx-vals='{"action":"quick_call","lead_id":"<?= (int) $lead['id'] ?>","outcome":"ready_to_buy"}'
                hx-target="#lead-panel" hx-swap="outerHTML">Ready to Purchase</button>
    </div>

    <?php if ($canInvoice): ?>
    <a href="<?= e(url('invoices', ['lead_id' => $lead['id'], 'create' => 1])) ?>"
       class="block w-full text-center px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
        Generate Invoice
    </a>
    <?php endif; ?>
</div>
