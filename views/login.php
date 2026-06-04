<?php if (current_user()) { redirect('index.php?page=dashboard'); } ?>
<div class="auth-page">
<div class="auth-card">
    <h1><?= e(setting($pdo, 'company_name', 'Sales CRM')) ?></h1>
    <p class="subtitle">Sign in to your sales workspace</p>
    <form method="post" action="<?= e(url('login')) ?>">
        <?= csrf_field() ?>
        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required autocomplete="username">
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Sign in</button>
    </form>
</div>
</div>
