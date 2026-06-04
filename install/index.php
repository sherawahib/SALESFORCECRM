<?php

declare(strict_types=1);

$configFile = dirname(__DIR__) . '/config/config.php';
if (is_file($configFile)) {
    header('Location: ../index.php');
    exit;
}

$step = (int) ($_GET['step'] ?? 1);
$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($step === 1) {
        $host = trim($_POST['db_host'] ?? 'localhost');
        $name = trim($_POST['db_name'] ?? '');
        $user = trim($_POST['db_user'] ?? '');
        $pass = (string) ($_POST['db_pass'] ?? '');
        $appUrl = rtrim(trim($_POST['app_url'] ?? ''), '/');
        $company = trim($_POST['company_name'] ?? 'Sales CRM');

        if ($name === '' || $user === '' || $appUrl === '') {
            $error = 'Please fill in all required fields.';
        } else {
            try {
                $pdo = new PDO(
                    "mysql:host={$host};charset=utf8mb4",
                    $user,
                    $pass,
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `{$name}`");

                $schema = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
                $statements = array_filter(array_map('trim', explode(';', $schema)));
                foreach ($statements as $sql) {
                    if ($sql !== '' && !preg_match('/^--/', $sql)) {
                        $pdo->exec($sql);
                    }
                }

                $adminEmail = trim($_POST['admin_email'] ?? 'admin@example.com');
                $adminPass = $_POST['admin_password'] ?? 'admin123';
                $adminName = trim($_POST['admin_name'] ?? 'Administrator');
                $hash = password_hash($adminPass, PASSWORD_DEFAULT);

                $pdo->prepare('UPDATE settings SET setting_value = ? WHERE setting_key = ?')->execute([$company, 'company_name']);

                $roleId = $pdo->query("SELECT id FROM roles WHERE slug = 'admin'")->fetchColumn();
                $stmt = $pdo->prepare(
                    'INSERT INTO users (role_id, name, email, password_hash) VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)'
                );
                $stmt->execute([$roleId, $adminName, $adminEmail, $hash]);

                $configContent = "<?php\nreturn " . var_export([
                    'app_name' => $company,
                    'app_url' => $appUrl,
                    'timezone' => 'UTC',
                    'db' => [
                        'host' => $host,
                        'name' => $name,
                        'user' => $user,
                        'pass' => $pass,
                        'charset' => 'utf8mb4',
                    ],
                    'session_name' => 'sales_crm_session',
                    'debug' => false,
                ], true) . ";\n";

                if (!is_dir(dirname($configFile))) {
                    mkdir(dirname($configFile), 0755, true);
                }
                file_put_contents($configFile, $configContent);
                $success = 'Installation complete! You can now log in.';
                $step = 3;
            } catch (Throwable $e) {
                $error = 'Installation failed: ' . $e->getMessage();
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install — Sales CRM</title>
    <link rel="stylesheet" href="../assets/css/app.css">
</head>
<body class="auth-page">
<div class="auth-card" style="max-width:520px">
    <h1>Install Sales CRM</h1>
    <?php if ($error): ?><div class="alert alert-error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <?php if ($success): ?>
        <div class="alert alert-success"><?= htmlspecialchars($success) ?></div>
        <a href="../index.php?page=login" class="btn btn-primary btn-block">Go to Login</a>
    <?php elseif ($step < 3): ?>
    <form method="post">
        <h2 class="text-muted" style="font-size:0.95rem;margin-bottom:1rem">Database (cPanel MySQL)</h2>
        <div class="form-group">
            <label>Database Host</label>
            <input type="text" name="db_host" value="localhost" required>
        </div>
        <div class="form-group">
            <label>Database Name *</label>
            <input type="text" name="db_name" required placeholder="cpanel_dbname">
        </div>
        <div class="form-group">
            <label>Database User *</label>
            <input type="text" name="db_user" required>
        </div>
        <div class="form-group">
            <label>Database Password</label>
            <input type="password" name="db_pass">
        </div>
        <div class="form-group">
            <label>Application URL *</label>
            <input type="url" name="app_url" required placeholder="https://yourdomain.com/crm">
        </div>
        <div class="form-group">
            <label>Company Name</label>
            <input type="text" name="company_name" value="Sales CRM">
        </div>
        <h2 class="text-muted" style="font-size:0.95rem;margin:1.5rem 0 1rem">Admin Account</h2>
        <div class="form-group">
            <label>Admin Name</label>
            <input type="text" name="admin_name" value="Administrator">
        </div>
        <div class="form-group">
            <label>Admin Email</label>
            <input type="email" name="admin_email" value="admin@example.com" required>
        </div>
        <div class="form-group">
            <label>Admin Password</label>
            <input type="password" name="admin_password" value="admin123" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Install CRM</button>
    </form>
    <?php endif; ?>
</div>
</body>
</html>
