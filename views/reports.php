<?php
require_roles([ROLE_ADMIN]);

$stats = [
    'total_leads' => (int) $pdo->query('SELECT COUNT(*) FROM leads')->fetchColumn(),
    'won_leads' => (int) $pdo->query("SELECT COUNT(*) FROM leads WHERE status = 'won'")->fetchColumn(),
    'revenue' => (float) $pdo->query("SELECT COALESCE(SUM(total),0) FROM invoices WHERE status = 'paid'")->fetchColumn(),
    'active_projects' => (int) $pdo->query("SELECT COUNT(*) FROM projects WHERE status NOT IN ('completed','cancelled','refunded','chargeback')")->fetchColumn(),
    'completed_projects' => (int) $pdo->query("SELECT COUNT(*) FROM projects WHERE status = 'completed'")->fetchColumn(),
];

$bySeller = $pdo->query(
    "SELECT u.name, COUNT(l.id) AS leads, SUM(CASE WHEN l.status='won' THEN 1 ELSE 0 END) AS won
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.slug = 'seller'
     LEFT JOIN leads l ON l.assigned_seller_id = u.id
     GROUP BY u.id ORDER BY won DESC"
)->fetchAll();
?>

<div class="stats-grid">
    <div class="stat-card"><div class="label">Total Leads</div><div class="value"><?= $stats['total_leads'] ?></div></div>
    <div class="stat-card"><div class="label">Won Leads</div><div class="value"><?= $stats['won_leads'] ?></div></div>
    <div class="stat-card"><div class="label">Paid Revenue</div><div class="value" style="font-size:1.1rem"><?= format_money($stats['revenue']) ?></div></div>
    <div class="stat-card"><div class="label">Active Projects</div><div class="value"><?= $stats['active_projects'] ?></div></div>
</div>

<div class="card">
    <div class="card-header"><h2>Seller Performance</h2></div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>Seller</th><th>Leads</th><th>Won</th><th>Conversion</th></tr></thead>
            <tbody>
                <?php foreach ($bySeller as $s): ?>
                <tr>
                    <td><?= e($s['name']) ?></td>
                    <td><?= (int) $s['leads'] ?></td>
                    <td><?= (int) $s['won'] ?></td>
                    <td><?= $s['leads'] ? round(100 * $s['won'] / $s['leads'], 1) . '%' : '—' ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
