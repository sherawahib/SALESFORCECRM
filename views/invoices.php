<?php
require_roles([ROLE_ADMIN, ROLE_SELLER]);
$user = current_user();
$leadId = (int) ($_GET['lead_id'] ?? 0);
$showCreate = !empty($_GET['create']);

$categories = $pdo->query('SELECT * FROM service_categories ORDER BY name')->fetchAll();
$clients = $pdo->query('SELECT id, contact_name, company_name, email FROM clients ORDER BY contact_name')->fetchAll();

if ($leadId) {
    $leadStmt = $pdo->prepare('SELECT * FROM leads WHERE id = ?');
    $leadStmt->execute([$leadId]);
    $prefillLead = $leadStmt->fetch();
} else {
    $prefillLead = null;
}

if ($user['role_slug'] === ROLE_ADMIN) {
    $invoices = $pdo->query(
        "SELECT i.*, c.contact_name, c.company_name, c.email AS client_email, sc.name AS category_name
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         JOIN service_categories sc ON sc.id = i.service_category_id
         ORDER BY i.created_at DESC LIMIT 100"
    )->fetchAll();
} else {
    $stmt = $pdo->prepare(
        "SELECT i.*, c.contact_name, c.company_name, c.email AS client_email, sc.name AS category_name
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         JOIN service_categories sc ON sc.id = i.service_category_id
         WHERE i.seller_id = ?
         ORDER BY i.created_at DESC LIMIT 100"
    );
    $stmt->execute([(int) $user['id']]);
    $invoices = $stmt->fetchAll();
}
?>

<?php if ($showCreate || $prefillLead): ?>
<div class="card">
    <div class="card-header"><h2>Create Invoice</h2></div>
    <div class="card-body">
        <form method="post" action="<?= e(url('invoices')) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="lead_id" value="<?= $leadId ?>">
            <div class="form-grid">
                <?php if ($prefillLead): ?>
                <div class="form-group" style="grid-column:1/-1">
                    <label>From Lead</label>
                    <input type="text" readonly value="<?= e($prefillLead['lead_code'] . ' — ' . $prefillLead['contact_name']) ?>">
                </div>
                <?php endif; ?>
                <div class="form-group">
                    <label>Client Name *</label>
                    <input type="text" name="contact_name" required value="<?= e($prefillLead['contact_name'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>Company</label>
                    <input type="text" name="company_name" value="<?= e($prefillLead['company_name'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value="<?= e($prefillLead['email'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value="<?= e($prefillLead['phone'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>Service Category *</label>
                    <select name="service_category_id" required>
                        <?php foreach ($categories as $cat): ?>
                        <option value="<?= (int) $cat['id'] ?>"><?= e($cat['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>Production Route *</label>
                    <select name="project_category" required>
                        <option value="design">Design</option>
                        <option value="development">Development</option>
                        <option value="combo">Design + Development (Combo)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Payment State</label>
                    <select name="payment_state" id="paymentState">
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partially Paid</option>
                        <option value="paid">Paid (auto-create project)</option>
                    </select>
                </div>
                <div class="form-group" id="partialAmount" style="display:none">
                    <label>Amount Received</label>
                    <input type="number" name="amount_paid" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>Due Date</label>
                    <input type="date" name="due_date">
                </div>
            </div>
            <h3 style="font-size:0.95rem;margin:1rem 0">Line Items</h3>
            <div id="lineItems">
                <div class="form-grid line-item">
                    <div class="form-group"><label>Description</label><input type="text" name="item_desc[]" required></div>
                    <div class="form-group"><label>Qty</label><input type="number" name="item_qty[]" value="1" step="0.01" min="0"></div>
                    <div class="form-group"><label>Unit Price</label><input type="number" name="item_price[]" step="0.01" min="0" required></div>
                </div>
            </div>
            <div class="form-group">
                <label>Tax %</label>
                <input type="number" name="tax_rate" step="0.01" value="<?= e(setting($pdo, 'tax_rate', '0')) ?>">
            </div>
            <div class="form-group">
                <label>Discount</label>
                <input type="number" name="discount" step="0.01" value="0">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes"></textarea>
            </div>
            <script>document.getElementById('paymentState')?.addEventListener('change',function(e){document.getElementById('partialAmount').style.display=e.target.value==='partial'?'block':'none';});</script>
            <div class="mt-2">
                <button type="submit" class="btn btn-primary">Generate Invoice</button>
            </div>
        </form>
    </div>
</div>
<?php endif; ?>

<div class="card">
    <div class="card-header flex flex-between">
        <h2>Invoices</h2>
        <a href="<?= e(url('invoices', ['create' => 1])) ?>" class="btn btn-primary btn-sm">+ New Invoice</a>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr><th>Number</th><th>Client</th><th>Category</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
                <?php foreach ($invoices as $inv): ?>
                <tr>
                    <td><strong><?= e($inv['invoice_number']) ?></strong></td>
                    <td><?= e($inv['contact_name']) ?></td>
                    <td><?= e($inv['category_name']) ?></td>
                    <td><?= format_money((float) $inv['total'], $inv['currency']) ?></td>
                    <td><?= status_badge($inv['status']) ?></td>
                    <td><?= format_datetime($inv['created_at']) ?></td>
                    <td class="flex flex-wrap gap-2 items-center">
                        <a href="<?= e(url('invoice_pdf', ['id' => $inv['id']])) ?>" class="text-sm text-slate-600 hover:text-indigo-600 font-medium" target="_blank">PDF</a>
                        <?php if (!empty($inv['client_email'])): ?>
                        <form method="post" action="<?= e(url('invoices')) ?>" class="inline">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="send_email">
                            <input type="hidden" name="invoice_id" value="<?= (int) $inv['id'] ?>">
                            <button type="submit" class="text-sm text-indigo-600 font-medium">Email</button>
                        </form>
                        <?php endif; ?>
                        <?php if ($inv['status'] === 'paid'): ?>
                        <a href="<?= e(url('projects')) ?>" class="text-indigo-600 text-sm">Projects</a>
                        <?php elseif (in_array($inv['status'], ['unpaid','partial','sent','draft'], true)): ?>
                        <form method="post" action="<?= e(url('invoices')) ?>" class="inline">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="mark_paid">
                            <input type="hidden" name="invoice_id" value="<?= (int) $inv['id'] ?>">
                            <button type="submit" class="text-sm text-emerald-600 font-medium">Mark Paid</button>
                        </form>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
