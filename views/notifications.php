<?php
$user = current_user();
$uid = (int) $user['id'];

if (!empty($_GET['read'])) {
    $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$uid]);
}

$stmt = $pdo->prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100');
$stmt->execute([$uid]);
$notifications = $stmt->fetchAll();
?>

<div class="card">
    <div class="card-header flex flex-between">
        <h2>Notifications</h2>
        <a href="<?= e(url('notifications', ['read' => 1])) ?>" class="btn btn-sm btn-secondary">Mark all read</a>
    </div>
    <div class="card-body">
        <ul class="timeline">
            <?php foreach ($notifications as $n): ?>
            <li style="<?= $n['is_read'] ? 'opacity:0.7' : '' ?>">
                <strong><?= e($n['title']) ?></strong>
                <?php if (!$n['is_read']): ?> <span class="badge badge-new">New</span><?php endif; ?>
                <p><?= e($n['message']) ?></p>
                <?php if ($n['link']): ?><a href="<?= e($n['link']) ?>">View →</a><?php endif; ?>
                <span class="time"><?= format_datetime($n['created_at']) ?></span>
            </li>
            <?php endforeach; ?>
            <?php if (!$notifications): ?>
            <p class="empty-state">No notifications.</p>
            <?php endif; ?>
        </ul>
    </div>
</div>
