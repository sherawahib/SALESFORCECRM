<?php

declare(strict_types=1);

/**
 * Phase 3 — Auto-route paid invoices to production projects.
 */
require_once __DIR__ . '/project_helpers.php';

function project_allocator_from_invoice(PDO $pdo, int $invoiceId, int $sellerId): void
{
    create_projects_from_paid_invoice($pdo, $invoiceId, $sellerId);
}
