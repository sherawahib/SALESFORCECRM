<?php

require_roles([ROLE_ADMIN]);
if (!verify_csrf()) {
    redirect('index.php?page=settings');
}

$action = post_string('action', 'save');

$stmt = $pdo->prepare(
    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
);

if ($action === 'test_smtp') {
    $to = post_string('test_email');
    $ok = crm_send_test_email($pdo, $to);
    flash($ok ? 'success' : 'error', $ok ? 'Test email sent (check BCC inbox too if enabled).' : 'Test failed — verify SMTP settings.');
    redirect('index.php?page=settings');
}

if ($action === 'save_branding') {
    $keys = [
        'company_name', 'company_tagline', 'company_address', 'company_phone', 'company_email', 'company_website',
        'bank_account_name', 'bank_name', 'bank_account_number', 'bank_routing_number', 'bank_iban', 'bank_swift',
        'invoice_payment_terms', 'invoice_footer_text',
    ];
    foreach ($keys as $key) {
        if (isset($_POST[$key])) {
            $stmt->execute([$key, trim((string) $_POST[$key])]);
        }
    }
    if (save_company_logo_upload($pdo)) {
        flash('success', 'Branding saved (logo updated).');
    } else {
        flash('success', 'Branding saved.');
    }
    redirect('index.php?page=settings');
}

if ($action === 'save_smtp') {
    $stmt->execute(['smtp_enabled', !empty($_POST['smtp_enabled']) ? '1' : '0']);
    $stmt->execute(['smtp_bcc_enabled', !empty($_POST['smtp_bcc_enabled']) ? '1' : '0']);
    foreach (['smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_from_email', 'smtp_from_name', 'smtp_bcc_emails'] as $k) {
        if (isset($_POST[$k])) {
            $stmt->execute([$k, trim((string) $_POST[$k])]);
        }
    }
    if (post_string('smtp_password') !== '') {
        $stmt->execute(['smtp_password', post_string('smtp_password')]);
    }
    flash('success', 'SMTP and BCC settings saved.');
    redirect('index.php?page=settings');
}

$generalKeys = ['currency_default', 'tax_rate', 'lead_prefix', 'invoice_prefix', 'project_prefix', 'assignment_mode'];
foreach ($generalKeys as $key) {
    if (isset($_POST[$key])) {
        $stmt->execute([$key, trim((string) $_POST[$key])]);
    }
}
$stmt->execute(['email_notifications', !empty($_POST['email_notifications']) ? '1' : '0']);

flash('success', 'Settings saved.');
redirect('index.php?page=settings');
