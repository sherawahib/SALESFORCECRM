<?php
/** @var array $leads */
/** @var int|null $selectedId */
?>
<div id="queue-list" class="divide-y divide-gray-100">
    <?php foreach ($leads as $l):
        $tier = $l['queue_tier'] ?? 'new';
        $tierLabel = $tier === 'hot' ? 'Hot' : ($tier === 'cold' ? 'Cold' : 'New');
        $active = ($selectedId ?? 0) === (int) $l['id'];
    ?>
    <a href="<?= e(url('seller_workspace', ['id' => $l['id']])) ?>"
       hx-get="<?= e(url('api', ['action' => 'lead_panel', 'id' => $l['id']])) ?>"
       hx-target="#lead-panel" hx-swap="outerHTML"
       class="block px-4 py-3 hover:bg-indigo-50 transition <?= $active ? 'bg-indigo-50 border-l-4 border-indigo-600' : '' ?>">
        <div class="flex justify-between items-start gap-2">
            <span class="text-xs font-bold <?= $tier === 'hot' ? 'text-red-600' : 'text-slate-500' ?>">[<?= e($tierLabel) ?>]</span>
            <?= status_badge($l['priority']) ?>
        </div>
        <p class="font-semibold text-gray-900 text-sm mt-1"><?= e($l['contact_name']) ?></p>
        <p class="text-xs text-slate-500 truncate"><?= e($l['company_name'] ?? $l['phone'] ?? '') ?></p>
    </a>
    <?php endforeach; ?>
    <?php if (empty($leads)): ?>
    <p class="p-6 text-sm text-slate-400 text-center">Queue empty. Check callbacks or request new leads.</p>
    <?php endif; ?>
</div>
