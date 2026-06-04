<?php

if (!verify_csrf()) {
    flash('error', 'Invalid request.');
    redirect('index.php?page=login');
}

$email = post_string('email');
$password = post_string('password');

if (login_user($pdo, $email, $password)) {
    redirect('index.php?page=dashboard');
}

flash('error', 'Invalid email or password.');
redirect('index.php?page=login');
