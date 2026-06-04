<?php

declare(strict_types=1);

function invoice_branding(PDO $pdo): array
{
    $logoPath = setting($pdo, 'company_logo_path', '');
    $logoFull = ($logoPath && is_file(CRM_ROOT . '/' . $logoPath)) ? CRM_ROOT . '/' . $logoPath : null;
    $logoUrl = $logoPath ? asset_url($logoPath) : null;

    $bank = array_filter([
        'account_name' => setting($pdo, 'bank_account_name', ''),
        'bank_name' => setting($pdo, 'bank_name', ''),
        'account_number' => setting($pdo, 'bank_account_number', ''),
        'routing' => setting($pdo, 'bank_routing_number', ''),
        'iban' => setting($pdo, 'bank_iban', ''),
        'swift' => setting($pdo, 'bank_swift', ''),
    ]);

    return [
        'company_name' => setting($pdo, 'company_name', 'Sales CRM'),
        'tagline' => setting($pdo, 'company_tagline', ''),
        'address' => setting($pdo, 'company_address', ''),
        'phone' => setting($pdo, 'company_phone', ''),
        'email' => setting($pdo, 'company_email', ''),
        'website' => setting($pdo, 'company_website', ''),
        'payment_terms' => setting($pdo, 'invoice_payment_terms', ''),
        'footer_text' => setting($pdo, 'invoice_footer_text', ''),
        'logo_full_path' => $logoFull,
        'logo_url' => $logoUrl,
        'bank' => $bank,
    ];
}

function invoice_bank_lines(array $brand): array
{
    $b = $brand['bank'];
    $lines = [];
    if (!empty($b['account_name'])) {
        $lines[] = 'Account name: ' . $b['account_name'];
    }
    if (!empty($b['bank_name'])) {
        $lines[] = 'Bank: ' . $b['bank_name'];
    }
    if (!empty($b['account_number'])) {
        $lines[] = 'Account / A/C: ' . $b['account_number'];
    }
    if (!empty($b['routing'])) {
        $lines[] = 'Routing / Sort: ' . $b['routing'];
    }
    if (!empty($b['iban'])) {
        $lines[] = 'IBAN: ' . $b['iban'];
    }
    if (!empty($b['swift'])) {
        $lines[] = 'SWIFT / BIC: ' . $b['swift'];
    }
    return $lines;
}

function invoice_company_lines(array $brand): array
{
    $lines = [];
    if ($brand['address']) {
        foreach (preg_split('/\r\n|\r|\n/', $brand['address']) as $line) {
            $line = trim($line);
            if ($line !== '') {
                $lines[] = $line;
            }
        }
    }
    if ($brand['phone']) {
        $lines[] = 'Tel: ' . $brand['phone'];
    }
    if ($brand['email']) {
        $lines[] = $brand['email'];
    }
    if ($brand['website']) {
        $lines[] = $brand['website'];
    }
    return $lines;
}

function save_company_logo_upload(PDO $pdo): bool
{
    if (empty($_FILES['company_logo']['tmp_name']) || ($_FILES['company_logo']['error'] ?? 0) !== UPLOAD_ERR_OK) {
        return false;
    }
    $tmp = $_FILES['company_logo']['tmp_name'];
    $mime = mime_content_type($tmp) ?: '';
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
    if (!isset($allowed[$mime])) {
        return false;
    }
    if (($_FILES['company_logo']['size'] ?? 0) > 2097152) {
        return false;
    }
    $dir = CRM_ROOT . '/uploads/branding';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $ext = $allowed[$mime];
    $rel = 'uploads/branding/company_logo.' . $ext;
    $full = CRM_ROOT . '/' . $rel;
    foreach (glob($dir . '/company_logo.*') ?: [] as $old) {
        @unlink($old);
    }
    if (!move_uploaded_file($tmp, $full)) {
        return false;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    $stmt->execute(['company_logo_path', $rel]);
    return true;
}

function render_invoice_email_html(PDO $pdo, array $inv, array $items, string $pdfLink): string
{
    $brand = invoice_branding($pdo);
    $bankLines = invoice_bank_lines($brand);
    ob_start();
    ?>
<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
  <div style="border-bottom:3px solid #4f46e5;padding-bottom:16px;margin-bottom:20px">
    <?php if ($brand['logo_url']): ?>
    <img src="<?= e($brand['logo_url']) ?>" alt="" style="max-height:56px;max-width:200px;margin-bottom:8px">
    <?php endif; ?>
    <h1 style="margin:0;font-size:22px;color:#0f172a"><?= e($brand['company_name']) ?></h1>
    <?php if ($brand['tagline']): ?><p style="margin:4px 0 0;color:#64748b;font-size:13px"><?= e($brand['tagline']) ?></p><?php endif; ?>
  </div>
  <p>Hello <?= e($inv['contact_name']) ?>,</p>
  <p>Please find invoice <strong><?= e($inv['invoice_number']) ?></strong> attached below.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
    <thead><tr style="background:#f1f5f9">
      <th style="padding:8px;text-align:left;border:1px solid #e2e8f0">Description</th>
      <th style="padding:8px;border:1px solid #e2e8f0">Qty</th>
      <th style="padding:8px;border:1px solid #e2e8f0">Amount</th>
    </tr></thead>
    <tbody>
    <?php foreach ($items as $item): ?>
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0"><?= e($item['description']) ?></td>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:center"><?= e($item['quantity']) ?></td>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:right"><?= number_format((float) $item['line_total'], 2) ?></td>
    </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <p style="font-size:18px;font-weight:bold">Total: <?= e($inv['currency']) ?> <?= number_format((float) $inv['total'], 2) ?></p>
  <p style="margin:20px 0"><a href="<?= e($pdfLink) ?>" style="background:#4f46e5;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600">Download PDF Invoice</a></p>
  <?php if ($bankLines): ?>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-top:20px">
    <p style="margin:0 0 8px;font-weight:600;font-size:13px;text-transform:uppercase;color:#475569">Payment details</p>
    <?php foreach ($bankLines as $line): ?><p style="margin:2px 0;font-size:13px"><?= e($line) ?></p><?php endforeach; ?>
  </div>
  <?php endif; ?>
  <?php if ($brand['payment_terms']): ?><p style="font-size:12px;color:#64748b;margin-top:16px"><?= e($brand['payment_terms']) ?></p><?php endif; ?>
</div>
    <?php
    return (string) ob_get_clean();
}
