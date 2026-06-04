<?php

declare(strict_types=1);

/**
 * Phase 4 — Client revision cycle (auditable sequence).
 */
require_once __DIR__ . '/project_helpers.php';

function open_revision_for_project(PDO $pdo, int $projectId, int $openedByUserId, string $clientFeedback): int
{
    $revNum = next_revision_number($pdo, $projectId);

    $lastAssignee = $pdo->prepare('SELECT assignee_id FROM project_assignments WHERE project_id = ? ORDER BY id DESC LIMIT 1');
    $lastAssignee->execute([$projectId]);
    $assigneeId = (int) ($lastAssignee->fetchColumn() ?: 0);

    $pdo->prepare(
        'INSERT INTO project_revisions (project_id, revision_number, opened_by, opened_reason, assignee_id, status)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$projectId, $revNum, $openedByUserId, $clientFeedback, $assigneeId ?: null, 'open_revision']);

    $pdo->prepare("UPDATE projects SET status = 'in_progress' WHERE id = ?")->execute([$projectId]);

    return $revNum;
}
