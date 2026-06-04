<?php

declare(strict_types=1);

function stream_invoice_pdf(PDO $pdo, int $invoiceId): void
{
    $stmt = $pdo->prepare(
        'SELECT i.*, c.contact_name, c.company_name, c.email AS client_email, c.phone AS client_phone, c.billing_address,
                sc.name AS category_name, u.name AS seller_name
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         JOIN service_categories sc ON sc.id = i.service_category_id
         JOIN users u ON u.id = i.seller_id
         WHERE i.id = ?'
    );
    $stmt->execute([$invoiceId]);
    $inv = $stmt->fetch();
    if (!$inv) {
        http_response_code(404);
        echo 'Invoice not found';
        exit;
    }

    $itemsStmt = $pdo->prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id');
    $itemsStmt->execute([$invoiceId]);
    $items = $itemsStmt->fetchAll();

    $brand = invoice_branding($pdo);
    $fpdfPath = CRM_ROOT . '/lib/fpdf/fpdf.php';
    if (!is_file($fpdfPath)) {
        header('Content-Type: text/html; charset=utf-8');
        echo render_invoice_html($pdo, $inv, $items, true);
        exit;
    }

    require_once $fpdfPath;
    $pdf = new FPDF();
    $pdf->AddPage();
    $yStart = 12;
    $pdf->SetY($yStart);

    if ($brand['logo_full_path']) {
        try {
            $pdf->Image($brand['logo_full_path'], 10, $yStart, 42);
            $pdf->SetXY(58, $yStart);
        } catch (Throwable $e) {
            $pdf->SetXY(10, $yStart);
        }
    } else {
        $pdf->SetXY(10, $yStart);
    }

    $pdf->SetFont('Arial', 'B', 16);
    $pdf->Cell(0, 8, $brand['company_name'], 0, 1);
    $pdf->SetFont('Arial', 'I', 9);
    if ($brand['tagline']) {
        $pdf->SetX($brand['logo_full_path'] ? 58 : 10);
        $pdf->Cell(0, 5, $brand['tagline'], 0, 1);
    }
    $pdf->SetFont('Arial', '', 8);
    $pdf->SetX($brand['logo_full_path'] ? 58 : 10);
    foreach (invoice_company_lines($brand) as $line) {
        $pdf->Cell(0, 4, $line, 0, 1);
    }

    $pdf->Ln(6);
    $pdf->SetFont('Arial', 'B', 12);
    $pdf->SetTextColor(79, 70, 229);
    $pdf->Cell(0, 8, 'INVOICE ' . $inv['invoice_number'], 0, 1);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->SetFont('Arial', '', 10);
    $pdf->Ln(2);

    $pdf->SetFont('Arial', 'B', 11);
    $pdf->Cell(95, 6, 'Bill To:', 0, 0);
    $pdf->Cell(95, 6, 'Invoice Details:', 0, 1);
    $pdf->SetFont('Arial', '', 10);
    $pdf->Cell(95, 5, $inv['contact_name'], 0, 0);
    $pdf->Cell(95, 5, 'Date: ' . date('M j, Y', strtotime($inv['created_at'])), 0, 1);
    if ($inv['company_name']) {
        $pdf->Cell(95, 5, $inv['company_name'], 0, 0);
    }
    $pdf->Cell(95, 5, 'Status: ' . strtoupper($inv['status']), 0, 1);
    if ($inv['client_email']) {
        $pdf->Cell(95, 5, $inv['client_email'], 0, 0);
    }
    $pdf->Cell(95, 5, 'Due: ' . ($inv['due_date'] ? date('M j, Y', strtotime($inv['due_date'])) : '—'), 0, 1);
    if ($inv['client_phone']) {
        $pdf->Cell(95, 5, $inv['client_phone'], 0, 0);
    }
    $pdf->Cell(95, 5, 'Category: ' . $inv['category_name'], 0, 1);
    $pdf->Ln(6);

    $pdf->SetFillColor(79, 70, 229);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->SetFont('Arial', 'B', 10);
    $pdf->Cell(100, 7, 'Description', 1, 0, 'L', true);
    $pdf->Cell(25, 7, 'Qty', 1, 0, 'C', true);
    $pdf->Cell(30, 7, 'Unit', 1, 0, 'R', true);
    $pdf->Cell(35, 7, 'Total', 1, 1, 'R', true);
    $pdf->SetTextColor(0, 0, 0);
    $pdf->SetFont('Arial', '', 10);
    $fill = false;
    foreach ($items as $item) {
        if ($fill) {
            $pdf->SetFillColor(248, 250, 252);
        }
        $pdf->Cell(100, 7, mb_substr($item['description'], 0, 55), 1, 0, 'L', $fill);
        $pdf->Cell(25, 7, $item['quantity'], 1, 0, 'C', $fill);
        $pdf->Cell(30, 7, number_format((float) $item['unit_price'], 2), 1, 0, 'R', $fill);
        $pdf->Cell(35, 7, number_format((float) $item['line_total'], 2), 1, 1, 'R', $fill);
        $fill = !$fill;
    }
    $pdf->Ln(4);
    $pdf->Cell(155, 6, 'Subtotal:', 0, 0, 'R');
    $pdf->Cell(35, 6, number_format((float) $inv['subtotal'], 2), 0, 1, 'R');
    if ((float) $inv['tax_amount'] > 0) {
        $pdf->Cell(155, 6, 'Tax:', 0, 0, 'R');
        $pdf->Cell(35, 6, number_format((float) $inv['tax_amount'], 2), 0, 1, 'R');
    }
    if ((float) $inv['discount'] > 0) {
        $pdf->Cell(155, 6, 'Discount:', 0, 0, 'R');
        $pdf->Cell(35, 6, '-' . number_format((float) $inv['discount'], 2), 0, 1, 'R');
    }
    $pdf->SetFont('Arial', 'B', 11);
    $pdf->Cell(155, 8, 'TOTAL (' . $inv['currency'] . '):', 0, 0, 'R');
    $pdf->Cell(35, 8, number_format((float) $inv['total'], 2), 0, 1, 'R');

    $bankLines = invoice_bank_lines($brand);
    if ($bankLines) {
        $pdf->Ln(8);
        $pdf->SetFillColor(241, 245, 249);
        $pdf->SetFont('Arial', 'B', 10);
        $pdf->Cell(0, 7, 'Payment / Bank Details', 0, 1, 'L', true);
        $pdf->SetFont('Arial', '', 9);
        foreach ($bankLines as $line) {
            $pdf->Cell(0, 5, $line, 0, 1);
        }
    }

    if ($brand['payment_terms']) {
        $pdf->Ln(4);
        $pdf->SetFont('Arial', 'I', 9);
        $pdf->MultiCell(0, 5, $brand['payment_terms']);
    }

    if (!empty($inv['notes'])) {
        $pdf->Ln(3);
        $pdf->SetFont('Arial', 'B', 10);
        $pdf->Cell(0, 6, 'Notes:', 0, 1);
        $pdf->SetFont('Arial', '', 9);
        $pdf->MultiCell(0, 5, $inv['notes']);
    }

    if ($brand['footer_text']) {
        $pdf->SetY(-20);
        $pdf->SetFont('Arial', '', 8);
        $pdf->SetTextColor(100, 116, 139);
        $pdf->Cell(0, 5, $brand['footer_text'], 0, 0, 'C');
    }

    $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $inv['invoice_number']) . '.pdf';
    $pdf->Output('D', $filename);
    exit;
}

function render_invoice_html(PDO $pdo, array $inv, array $items, bool $print = false): string
{
    $brand = invoice_branding($pdo);
    $bankLines = invoice_bank_lines($brand);
    ob_start();
    ?>
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Invoice <?= e($inv['invoice_number']) ?></title>
<style>
body{font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:800px;margin:40px auto}
.header{display:flex;gap:20px;align-items:flex-start;border-bottom:3px solid #4f46e5;padding-bottom:16px;margin-bottom:24px}
.header img{max-height:64px;max-width:180px}
.company-meta{font-size:13px;color:#64748b;line-height:1.5}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}
th{background:#4f46e5;color:#fff}
.bank{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-top:20px}
.total{font-size:1.25em;font-weight:bold;color:#4f46e5}
@media print{.no-print{display:none}}
</style></head>
<body>
<?php if ($print): ?><p class="no-print"><button onclick="window.print()">Print / Save as PDF</button></p><?php endif; ?>
<div class="header">
  <div>
    <?php if ($brand['logo_url']): ?><img src="<?= e($brand['logo_url']) ?>" alt=""><?php endif; ?>
  </div>
  <div style="flex:1">
    <h1 style="margin:0;font-size:24px"><?= e($brand['company_name']) ?></h1>
    <?php if ($brand['tagline']): ?><p style="margin:4px 0;color:#64748b"><?= e($brand['tagline']) ?></p><?php endif; ?>
    <div class="company-meta">
      <?php foreach (invoice_company_lines($brand) as $line): ?><?= e($line) ?><br><?php endforeach; ?>
    </div>
  </div>
</div>
<p><strong style="font-size:18px;color:#4f46e5">Invoice <?= e($inv['invoice_number']) ?></strong> · <?= e(ucfirst($inv['status'])) ?></p>
<p><strong>Bill to:</strong> <?= e($inv['contact_name']) ?><?= $inv['company_name'] ? ' — ' . e($inv['company_name']) : '' ?></p>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>
<?php foreach ($items as $item): ?>
<tr><td><?= e($item['description']) ?></td><td><?= e($item['quantity']) ?></td><td><?= number_format((float)$item['unit_price'], 2) ?></td><td><?= number_format((float)$item['line_total'], 2) ?></td></tr>
<?php endforeach; ?>
</tbody></table>
<p class="total">Total: <?= e($inv['currency']) ?> <?= number_format((float)$inv['total'], 2) ?></p>
<?php if ($bankLines): ?>
<div class="bank"><strong>Payment / Bank Details</strong><br>
<?php foreach ($bankLines as $line): ?><?= e($line) ?><br><?php endforeach; ?>
</div>
<?php endif; ?>
<?php if ($brand['payment_terms']): ?><p style="font-size:13px;color:#64748b"><?= e($brand['payment_terms']) ?></p><?php endif; ?>
<?php if ($brand['footer_text']): ?><p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:32px"><?= e($brand['footer_text']) ?></p><?php endif; ?>
</body></html>
    <?php
    return (string) ob_get_clean();
}
