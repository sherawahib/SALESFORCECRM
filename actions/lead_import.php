<?php

require_once CRM_ROOT . '/core/lead_parser.php';
require_roles([ROLE_ADMIN, ROLE_LEAD_FINDER]);
$user = current_user();

if (!verify_csrf() || post_string('action') !== 'csv_import') {
    redirect('index.php?page=lead_import');
}

if (empty($_FILES['csv_file']['tmp_name'])) {
    flash('error', 'Please upload a CSV file.');
    redirect('index.php?page=lead_import');
}

$handle = fopen($_FILES['csv_file']['tmp_name'], 'r');
if (!$handle) {
    flash('error', 'Could not read file.');
    redirect('index.php?page=lead_import');
}

$header = fgetcsv($handle);
if (!$header) {
    flash('error', 'Empty CSV.');
    redirect('index.php?page=lead_import');
}
$map = [];
foreach ($header as $i => $col) {
    $map[strtolower(trim($col))] = $i;
}

$required = ['contact_name'];
foreach ($required as $r) {
    if (!isset($map[$r])) {
        flash('error', "CSV must include column: {$r}");
        redirect('index.php?page=lead_import');
    }
}

$assignMode = post_string('assign_mode', 'manual');
$sellerId = post_int('assigned_seller_id') ?: null;
$prefix = setting($pdo, 'lead_prefix', 'LD');
$success = 0;
$rows = 0;

$pdo->prepare('INSERT INTO lead_import_batches (uploaded_by, filename, row_count, success_count) VALUES (?, ?, 0, 0)')
    ->execute([(int) $user['id'], basename($_FILES['csv_file']['name'] ?? 'import.csv')]);
$batchId = (int) $pdo->lastInsertId();

while (($row = fgetcsv($handle)) !== false) {
    $rows++;
    $contact = trim($row[$map['contact_name']] ?? '');
    if ($contact === '') {
        continue;
    }
    $assigned = $assignMode === 'round_robin' ? null : $sellerId;
    $status = $assigned ? 'assigned' : 'new';
    $rowData = [
        'company_name' => isset($map['company_name']) ? $row[$map['company_name']] ?? '' : '',
        'contact_name' => $contact,
        'email' => isset($map['email']) ? $row[$map['email']] ?? '' : '',
        'phone' => isset($map['phone']) ? $row[$map['phone']] ?? '' : '',
        'source' => isset($map['source']) ? $row[$map['source']] ?? '' : 'csv',
        'notes' => isset($map['notes']) ? $row[$map['notes']] ?? '' : '',
    ];
    $leadId = lead_parser_insert($pdo, (int) $user['id'], $rowData, $assigned, $status);
    if (!$leadId) {
        continue;
    }

    $codeRow = $pdo->prepare('SELECT lead_code FROM leads WHERE id = ?');
    $codeRow->execute([$leadId]);
    $code = $codeRow->fetchColumn() ?: '';

    if ($assignMode === 'round_robin') {
        assign_seller_round_robin($pdo, $leadId);
    } elseif ($assigned) {
        notify_user($pdo, $assigned, 'lead_assigned', 'CSV lead assigned', "Lead {$code} from import.", url('seller_workspace', ['id' => $leadId]));
    }
    $success++;
}
fclose($handle);

$pdo->prepare('UPDATE lead_import_batches SET row_count = ?, success_count = ? WHERE id = ?')->execute([$rows, $success, $batchId]);
flash('success', "Imported {$success} of {$rows} leads.");
redirect('index.php?page=lead_import');
