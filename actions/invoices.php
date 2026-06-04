<?php

require_roles([ROLE_ADMIN, ROLE_SELLER]);
$user = current_user();

if (!verify_csrf()) {
    flash('error', 'Invalid request.');
    redirect('index.php?page=invoices');
}

$action = post_string('action', 'create');

if ($action === 'send_email') {
    $invoiceId = post_int('invoice_id');
    $stmt = $pdo->prepare(
        'SELECT i.*, c.contact_name, c.email AS client_email FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id = ?'
    );
    $stmt->execute([$invoiceId]);
    $inv = $stmt->fetch();
    if (!$inv || empty($inv['client_email'])) {
        flash('error', 'Client email not found.');
        redirect('index.php?page=invoices');
    }
    $itemsStmt = $pdo->prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id');
    $itemsStmt->execute([$invoiceId]);
    $items = $itemsStmt->fetchAll();
    $brand = invoice_branding($pdo);
    $pdfLink = url('invoice_pdf', ['id' => $invoiceId]);
    $html = render_invoice_email_html($pdo, $inv, $items, $pdfLink);
    $subject = 'Invoice ' . $inv['invoice_number'] . ' from ' . $brand['company_name'];
    $ok = crm_send_email($pdo, $inv['client_email'], $subject, $html, (int) $user['id']);
    flash($ok ? 'success' : 'error', $ok ? 'Branded invoice emailed to client (BCC applied if enabled).' : 'Failed to send email. Check SMTP settings.');
    redirect('index.php?page=invoices');
}

if ($action === 'mark_paid') {
    $invoiceId = post_int('invoice_id');
    $pdo->prepare("UPDATE invoices SET status = 'paid', amount_paid = total, paid_at = NOW() WHERE id = ?")->execute([$invoiceId]);
    create_projects_from_paid_invoice($pdo, $invoiceId, (int) $user['id']);
    flash('success', 'Invoice marked paid. Production projects created.');
    redirect('index.php?page=invoices');
}

if ($action !== 'create') {
    redirect('index.php?page=invoices');
}

$leadId = post_int('lead_id') ?: null;
$categoryId = post_int('service_category_id');
$projectCategory = post_string('project_category', 'development');
if (!in_array($projectCategory, ['design', 'development', 'combo'], true)) {
    $projectCategory = 'development';
}

$descriptions = $_POST['item_desc'] ?? [];
$qtys = $_POST['item_qty'] ?? [];
$prices = $_POST['item_price'] ?? [];

$subtotal = 0.0;
$items = [];
foreach ($descriptions as $i => $desc) {
    $desc = trim((string) $desc);
    if ($desc === '') {
        continue;
    }
    $qty = (float) ($qtys[$i] ?? 1);
    $price = (float) ($prices[$i] ?? 0);
    $line = $qty * $price;
    $subtotal += $line;
    $items[] = ['description' => $desc, 'quantity' => $qty, 'unit_price' => $price, 'line_total' => $line];
}

if (!$items) {
    flash('error', 'Add at least one line item.');
    redirect('index.php?page=invoices&create=1');
}

$taxRate = post_float('tax_rate');
$discount = post_float('discount');
$taxAmount = round($subtotal * ($taxRate / 100), 2);
$total = $subtotal + $taxAmount - $discount;

$paymentState = post_string('payment_state', 'unpaid');
$amountPaid = 0.0;
$status = 'unpaid';
if ($paymentState === 'paid') {
    $status = 'paid';
    $amountPaid = $total;
} elseif ($paymentState === 'partial') {
    $status = 'partial';
    $amountPaid = post_float('amount_paid');
}

$pdo->beginTransaction();
try {
    $clientStmt = $pdo->prepare(
        'INSERT INTO clients (lead_id, seller_id, company_name, contact_name, email, phone) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $clientStmt->execute([
        $leadId,
        (int) $user['id'],
        post_string('company_name') ?: null,
        post_string('contact_name'),
        post_string('email') ?: null,
        post_string('phone') ?: null,
    ]);
    $clientId = (int) $pdo->lastInsertId();

    $invNum = generate_code($pdo, setting($pdo, 'invoice_prefix', 'INV'), 'invoices', 'invoice_number');

    $pdo->prepare(
        'INSERT INTO invoices (invoice_number, client_id, lead_id, seller_id, service_category_id, project_category, subtotal, tax_amount, discount, total, amount_paid, status, due_date, paid_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $invNum,
        $clientId,
        $leadId,
        (int) $user['id'],
        $categoryId,
        $projectCategory,
        $subtotal,
        $taxAmount,
        $discount,
        $total,
        $amountPaid,
        $status,
        post_string('due_date') ?: null,
        $status === 'paid' ? date('Y-m-d H:i:s') : null,
        post_string('notes') ?: null,
    ]);
    $invoiceId = (int) $pdo->lastInsertId();

    $itemStmt = $pdo->prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)');
    foreach ($items as $item) {
        $itemStmt->execute([$invoiceId, $item['description'], $item['quantity'], $item['unit_price'], $item['line_total']]);
    }

    if ($leadId) {
        $pdo->prepare("UPDATE leads SET status = 'won', won_at = COALESCE(won_at, NOW()) WHERE id = ?")->execute([$leadId]);
    }

    if ($status === 'paid') {
        create_projects_from_paid_invoice($pdo, $invoiceId, (int) $user['id']);
    }

    $pdo->commit();
    flash('success', "Invoice {$invNum} created (" . $status . ').' . ($status === 'paid' ? ' Routed to production.' : ''));
} catch (Throwable $e) {
    $pdo->rollBack();
    flash('error', 'Failed to create invoice: ' . $e->getMessage());
}

redirect('index.php?page=invoices');
