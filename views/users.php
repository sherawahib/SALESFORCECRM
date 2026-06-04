<?php
require_roles([ROLE_ADMIN]);

$roles = $pdo->query('SELECT * FROM roles ORDER BY id')->fetchAll();
$departments = $pdo->query('SELECT * FROM departments')->fetchAll();

$users = $pdo->query(
    'SELECT u.*, r.name AS role_name, r.slug AS role_slug, d.name AS dept_name
     FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN departments d ON d.id = u.department_id
     ORDER BY u.name'
)->fetchAll();

$heads = array_filter($users, fn($u) => in_array($u['role_slug'], [ROLE_DESIGN_HEAD, ROLE_DEV_HEAD], true));
?>

<div class="card">
    <div class="card-header flex flex-between">
        <h2>Team Members</h2>
        <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('userForm').style.display='block'">+ Add User</button>
    </div>
    <div class="card-body" id="userForm" style="display:none;border-bottom:1px solid var(--border)">
        <form method="post" action="<?= e(url('users')) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create">
            <div class="form-grid">
                <div class="form-group"><label>Name</label><input type="text" name="name" required></div>
                <div class="form-group"><label>Email</label><input type="email" name="email" required></div>
                <div class="form-group"><label>Password</label><input type="password" name="password" required></div>
                <div class="form-group">
                    <label>Role</label>
                    <select name="role_id" required>
                        <?php foreach ($roles as $r): ?>
                        <option value="<?= (int) $r['id'] ?>"><?= e($r['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>Department</label>
                    <select name="department_id">
                        <option value="">—</option>
                        <?php foreach ($departments as $d): ?>
                        <option value="<?= (int) $d['id'] ?>"><?= e($d['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>Reports To (Manager)</label>
                    <select name="manager_id">
                        <option value="">—</option>
                        <?php foreach ($heads as $h): ?>
                        <option value="<?= (int) $h['id'] ?>"><?= e($h['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary">Create User</button>
        </form>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Active</th></tr></thead>
            <tbody>
                <?php foreach ($users as $u): ?>
                <tr>
                    <td><?= e($u['name']) ?></td>
                    <td><?= e($u['email']) ?></td>
                    <td><?= e($u['role_name']) ?></td>
                    <td><?= e($u['dept_name'] ?? '—') ?></td>
                    <td><?= $u['is_active'] ? status_badge('paid') : status_badge('cancelled') ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
