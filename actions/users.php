<?php

require_roles([ROLE_ADMIN]);
if (!verify_csrf() || post_string('action') !== 'create') {
    redirect('index.php?page=users');
}

$email = post_string('email');
$exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$exists->execute([$email]);
if ($exists->fetch()) {
    flash('error', 'Email already exists.');
    redirect('index.php?page=users');
}

$deptId = post_int('department_id') ?: null;
$managerId = post_int('manager_id') ?: null;

$pdo->prepare(
    'INSERT INTO users (role_id, department_id, manager_id, name, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
)->execute([
    post_int('role_id'),
    $deptId,
    $managerId,
    post_string('name'),
    $email,
    password_hash(post_string('password'), PASSWORD_DEFAULT),
]);

flash('success', 'User created.');
redirect('index.php?page=users');
