<?php

declare(strict_types=1);

const UPLOAD_MAX_BYTES = 10485760; // 10 MB
const UPLOAD_ALLOWED_MIME = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
];

function upload_revision_files(PDO $pdo, array $user, int $projectId, ?int $revisionId, ?int $assignmentId, array $filesInput): array
{
    $saved = [];
    if (empty($filesInput['name']) || !is_array($filesInput['name'])) {
        return $saved;
    }

    $baseDir = CRM_ROOT . '/uploads/revisions/' . $projectId;
    if (!is_dir($baseDir)) {
        mkdir($baseDir, 0755, true);
    }

    $count = count($filesInput['name']);
    for ($i = 0; $i < $count; $i++) {
        if (($filesInput['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            continue;
        }
        $tmp = $filesInput['tmp_name'][$i] ?? '';
        $orig = $filesInput['name'][$i] ?? '';
        $size = (int) ($filesInput['size'][$i] ?? 0);
        $mime = mime_content_type($tmp) ?: ($filesInput['type'][$i] ?? 'application/octet-stream');

        if ($size > UPLOAD_MAX_BYTES || $size <= 0) {
            continue;
        }
        if (!in_array($mime, UPLOAD_ALLOWED_MIME, true)) {
            continue;
        }
        $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
        $safeExt = preg_replace('/[^a-z0-9]/', '', $ext);
        $stored = bin2hex(random_bytes(16)) . ($safeExt ? '.' . $safeExt : '');
        $relPath = 'uploads/revisions/' . $projectId . '/' . $stored;
        $fullPath = CRM_ROOT . '/' . $relPath;

        if (!move_uploaded_file($tmp, $fullPath)) {
            continue;
        }

        $pdo->prepare(
            'INSERT INTO revision_files (project_id, revision_id, assignment_id, uploaded_by, original_name, stored_name, file_path, file_size, mime_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $projectId,
            $revisionId,
            $assignmentId,
            (int) $user['id'],
            basename($orig),
            $stored,
            $relPath,
            $size,
            $mime,
        ]);
        $saved[] = ['name' => $orig, 'path' => $relPath];
    }
    return $saved;
}

function revision_files_for_project(PDO $pdo, int $projectId, ?int $revisionId = null): array
{
    if ($revisionId) {
        $stmt = $pdo->prepare('SELECT rf.*, u.name AS uploader FROM revision_files rf JOIN users u ON u.id = rf.uploaded_by WHERE rf.revision_id = ? ORDER BY rf.created_at');
        $stmt->execute([$revisionId]);
    } else {
        $stmt = $pdo->prepare('SELECT rf.*, u.name AS uploader FROM revision_files rf JOIN users u ON u.id = rf.uploaded_by WHERE rf.project_id = ? ORDER BY rf.created_at DESC');
        $stmt->execute([$projectId]);
    }
    return $stmt->fetchAll();
}

function revision_file_download_url(array $file): string
{
    return url('download', ['id' => $file['id']]);
}
