<?php
require_roles([ROLE_ADMIN]);

$settings = $pdo->query('SELECT * FROM settings ORDER BY setting_key')->fetchAll();
$settingsMap = [];
foreach ($settings as $s) {
    $settingsMap[$s['setting_key']] = $s['setting_value'];
}
$brand = invoice_branding($pdo);
?>

<div class="space-y-6">
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-900">Invoice branding & bank details</h2>
        <p class="text-sm text-slate-500 mt-1">Logo and payment info appear on PDF invoices and client invoice emails.</p>
        <form method="post" action="<?= e(url('settings')) ?>" enctype="multipart/form-data" class="mt-4 space-y-4">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="save_branding">
            <div class="flex flex-wrap gap-6 items-start">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Company logo</label>
                    <?php if ($brand['logo_url']): ?>
                    <img src="<?= e($brand['logo_url']) ?>?v=<?= time() ?>" alt="Logo" class="h-16 mb-2 border border-gray-100 rounded-lg p-2 bg-white">
                    <?php endif; ?>
                    <input type="file" name="company_logo" accept="image/jpeg,image/png,image/gif,image/webp" class="text-sm">
                    <p class="text-xs text-slate-400 mt-1">PNG or JPG, max 2MB. Recommended width 400px.</p>
                </div>
                <div class="flex-1 min-w-[240px] grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label class="text-sm font-medium">Company name</label><input type="text" name="company_name" value="<?= e($settingsMap['company_name'] ?? '') ?>" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm font-medium">Tagline</label><input type="text" name="company_tagline" value="<?= e($settingsMap['company_tagline'] ?? '') ?>" placeholder="Professional design & development" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
                    <div class="md:col-span-2"><label class="text-sm font-medium">Address</label><textarea name="company_address" rows="2" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"><?= e($settingsMap['company_address'] ?? '') ?></textarea></div>
                    <div><label class="text-sm font-medium">Phone</label><input type="text" name="company_phone" value="<?= e($settingsMap['company_phone'] ?? '') ?>" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm font-medium">Billing email</label><input type="email" name="company_email" value="<?= e($settingsMap['company_email'] ?? '') ?>" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
                    <div class="md:col-span-2"><label class="text-sm font-medium">Website</label><input type="url" name="company_website" value="<?= e($settingsMap['company_website'] ?? '') ?>" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
                </div>
            </div>
            <div class="border-t border-gray-100 pt-4">
                <h3 class="text-sm font-semibold text-gray-800 mb-3">Bank / payment details (shown on invoice)</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label class="text-sm">Account holder name</label><input type="text" name="bank_account_name" value="<?= e($settingsMap['bank_account_name'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm">Bank name</label><input type="text" name="bank_name" value="<?= e($settingsMap['bank_name'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm">Account number</label><input type="text" name="bank_account_number" value="<?= e($settingsMap['bank_account_number'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm">Routing / sort code</label><input type="text" name="bank_routing_number" value="<?= e($settingsMap['bank_routing_number'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm">IBAN</label><input type="text" name="bank_iban" value="<?= e($settingsMap['bank_iban'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm">SWIFT / BIC</label><input type="text" name="bank_swift" value="<?= e($settingsMap['bank_swift'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                </div>
            </div>
            <div><label class="text-sm font-medium">Payment terms</label><input type="text" name="invoice_payment_terms" value="<?= e($settingsMap['invoice_payment_terms'] ?? 'Payment due within 14 days.') ?>" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="text-sm font-medium">Invoice footer (optional)</label><input type="text" name="invoice_footer_text" value="<?= e($settingsMap['invoice_footer_text'] ?? '') ?>" placeholder="Thank you for your business" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Save branding</button>
        </form>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 class="text-lg font-semibold text-gray-900">General</h2>
            <form method="post" action="<?= e(url('settings')) ?>" class="mt-4 space-y-4">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Default Currency</label>
                    <input type="text" name="currency_default" value="<?= e($settingsMap['currency_default'] ?? 'USD') ?>" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Tax Rate %</label>
                    <input type="number" step="0.01" name="tax_rate" value="<?= e($settingsMap['tax_rate'] ?? '0') ?>" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Lead Assignment Mode</label>
                    <select name="assignment_mode" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="manual" <?= ($settingsMap['assignment_mode'] ?? '') === 'manual' ? 'selected' : '' ?>>Manual</option>
                        <option value="round_robin" <?= ($settingsMap['assignment_mode'] ?? '') === 'round_robin' ? 'selected' : '' ?>>Round-Robin</option>
                    </select>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <div><label class="text-xs text-slate-500">Lead prefix</label><input type="text" name="lead_prefix" value="<?= e($settingsMap['lead_prefix'] ?? 'LD') ?>" class="w-full border rounded-lg px-2 py-1.5 text-sm"></div>
                    <div><label class="text-xs text-slate-500">Invoice prefix</label><input type="text" name="invoice_prefix" value="<?= e($settingsMap['invoice_prefix'] ?? 'INV') ?>" class="w-full border rounded-lg px-2 py-1.5 text-sm"></div>
                    <div><label class="text-xs text-slate-500">Project prefix</label><input type="text" name="project_prefix" value="<?= e($settingsMap['project_prefix'] ?? 'PRJ') ?>" class="w-full border rounded-lg px-2 py-1.5 text-sm"></div>
                </div>
                <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="email_notifications" value="1" <?= ($settingsMap['email_notifications'] ?? '1') === '1' ? 'checked' : '' ?>> Send email alerts for in-app notifications</label>
                <button type="submit" class="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium">Save general</button>
            </form>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 class="text-lg font-semibold text-gray-900">SMTP & BCC</h2>
            <p class="text-sm text-slate-500 mt-1">BCC copies billing or management on every outbound email.</p>
            <form method="post" action="<?= e(url('settings')) ?>" class="mt-4 space-y-3">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_smtp">
                <label class="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="smtp_enabled" value="1" <?= ($settingsMap['smtp_enabled'] ?? '0') === '1' ? 'checked' : '' ?>> Enable SMTP</label>
                <div><label class="text-sm text-gray-700">Host</label><input type="text" name="smtp_host" value="<?= e($settingsMap['smtp_host'] ?? '') ?>" placeholder="mail.yourdomain.com" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="text-sm">Port</label><input type="number" name="smtp_port" value="<?= e($settingsMap['smtp_port'] ?? '587') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                    <div><label class="text-sm">Encryption</label><select name="smtp_encryption" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"><option value="tls" <?= ($settingsMap['smtp_encryption'] ?? 'tls') === 'tls' ? 'selected' : '' ?>>TLS</option><option value="ssl" <?= ($settingsMap['smtp_encryption'] ?? '') === 'ssl' ? 'selected' : '' ?>>SSL</option></select></div>
                </div>
                <div><label class="text-sm">Username</label><input type="text" name="smtp_username" value="<?= e($settingsMap['smtp_username'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                <div><label class="text-sm">Password</label><input type="password" name="smtp_password" placeholder="Leave blank to keep current" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                <div><label class="text-sm">From Email</label><input type="email" name="smtp_from_email" value="<?= e($settingsMap['smtp_from_email'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                <div><label class="text-sm">From Name</label><input type="text" name="smtp_from_name" value="<?= e($settingsMap['smtp_from_name'] ?? '') ?>" class="w-full mt-1 border rounded-lg px-3 py-2 text-sm"></div>
                <div class="border-t border-gray-100 pt-3 mt-3">
                    <label class="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="smtp_bcc_enabled" value="1" <?= ($settingsMap['smtp_bcc_enabled'] ?? '0') === '1' ? 'checked' : '' ?>> Enable BCC on all outbound mail</label>
                    <label class="text-sm text-gray-700 block mt-2">BCC addresses (comma-separated)</label>
                    <textarea name="smtp_bcc_emails" rows="2" placeholder="billing@company.com, manager@company.com" class="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"><?= e($settingsMap['smtp_bcc_emails'] ?? '') ?></textarea>
                </div>
                <button type="submit" class="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">Save SMTP</button>
            </form>
            <form method="post" action="<?= e(url('settings')) ?>" class="mt-4 pt-4 border-t border-gray-100">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="test_smtp">
                <label class="text-sm font-medium">Send test email to</label>
                <div class="flex gap-2 mt-1">
                    <input type="email" name="test_email" required placeholder="you@company.com" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <button type="submit" class="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Test</button>
                </div>
            </form>
        </div>
    </div>
</div>
