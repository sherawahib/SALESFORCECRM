<?php

require_roles([ROLE_ADMIN, ROLE_DESIGNER, ROLE_DEVELOPER]);
$user = current_user();

if (!verify_csrf() || post_string('action') !== 'start') {
    redirect('index.php?page=my_tasks');
}

$pdo->prepare("UPDATE project_assignments SET status = 'in_progress' WHERE id = ? AND assignee_id = ?")
    ->execute([post_int('assignment_id'), (int) $user['id']]);

flash('success', 'Task started.');
redirect('index.php?page=my_tasks');
