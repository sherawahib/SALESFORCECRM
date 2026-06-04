<?php

declare(strict_types=1);

/**
 * Phase 5 — Financial exception hooks (chargeback / freeze).
 */
require_once __DIR__ . '/project_helpers.php';

function freeze_assets_on_chargeback(PDO $pdo, int $projectId, int $userId): void
{
    freeze_project_chargeback($pdo, $projectId, $userId);
    audit_log($pdo, $userId, 'project', $projectId, 'CRITICAL_CHARGEBACK_FREEZE', ['context' => 'projects']);
}
