<?php

declare(strict_types=1);

/**
 * Phase 1 — Lead ingestion engine (sanitize + insert).
 * Used by dashboards/lead_import.php and single-lead forms.
 */

function lead_parser_sanitize_row(array $row): array
{
    return [
        'company_name' => htmlspecialchars(trim($row['company_name'] ?? $row['company'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'contact_name' => htmlspecialchars(trim($row['contact_name'] ?? $row['contact'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'email' => filter_var(trim($row['email'] ?? ''), FILTER_SANITIZE_EMAIL) ?: null,
        'phone' => htmlspecialchars(trim($row['phone'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'source' => htmlspecialchars(trim($row['source'] ?? 'import'), ENT_QUOTES, 'UTF-8'),
        'notes' => htmlspecialchars(trim($row['notes'] ?? ''), ENT_QUOTES, 'UTF-8'),
    ];
}

function lead_parser_insert(PDO $pdo, int $leadFinderId, array $row, ?int $assignedSellerId = null, string $status = 'new'): ?int
{
    $clean = lead_parser_sanitize_row($row);
    if ($clean['contact_name'] === '') {
        return null;
    }
    $code = generate_code($pdo, setting($pdo, 'lead_prefix', 'LD'), 'leads', 'lead_code');
    $pdo->prepare(
        'INSERT INTO leads (lead_code, created_by, assigned_seller_id, company_name, contact_name, email, phone, source, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $code,
        $leadFinderId,
        $assignedSellerId,
        $clean['company_name'] ?: null,
        $clean['contact_name'],
        $clean['email'],
        $clean['phone'] ?: null,
        $clean['source'],
        $clean['notes'] ?: null,
        $status,
    ]);
    return (int) $pdo->lastInsertId();
}
