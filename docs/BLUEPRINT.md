# Custom Sales & Production CRM — Implementation Map

This codebase implements the project blueprint across modules below.

## Module 1 — Architecture

| Blueprint | Implementation |
|-----------|----------------|
| PHP 8.2+ PDO | `core/` |
| MySQL 8 InnoDB FK | `database/schema.sql` |
| Tailwind UI | CDN in `components/layout/header.php` |
| HTMX async | `actions/api.php`, seller workspace |
| Alpine.js | Callback picker, sidebar toggle |
| `/core` | bootstrap, auth, router, helpers |
| `/components` | layout, partials |
| `/dashboards` | role-specific screens (seller workspace, CSV import) |
| `/views` | shared CRUD pages |

## Module 2 — Features

### 2.1 Sales pipeline
- CSV import wizard → `dashboards/lead_import.php`
- Round-robin assignment → `core/LeadService.php`, settings `assignment_mode`
- Split-pane seller workspace → `dashboards/seller_workspace.php`
- One-click call outcomes (HTMX) → `actions/api.php`

### 2.2 Billing
- Invoice states: unpaid, partial, paid, refunded, chargeback
- Project category: design / development / combo
- Paid → auto project routing → `core/project_helpers.php`
- Upsell sub-invoices → `actions/project_view.php` (`upsell` action)
- Budget = original paid + paid upsells → `recalculate_project_budget()`

### 2.3 Production
- Combo → two linked projects (`combo_group_id`)
- Head assignment with instructions + due dates
- Head gatekeeper before client review

### 2.4 Revision ledger
- v1, v2, v3… numbering
- States: review_pending → head_review → client_review → open_revision → resolved
- Seller open revision re-routes junior

## Add-ons (v3)

| Feature | Location |
|---------|----------|
| PDF invoices | `core/InvoicePdf.php`, `?page=invoice_pdf&id=` |
| SMTP + alerts | `core/Mailer.php`, Settings |
| Revision uploads | `core/FileUpload.php`, `uploads/revisions/` |
| Email log | `email_log` table, System Logs |

## Module 5 — Deploy

1. Upload to cPanel `public_html`
2. Create MySQL DB + user
3. Run `/install/` OR import `database/schema.sql`
4. Existing DB: run `database/migrations/002_blueprint_upgrade.sql` in phpMyAdmin
5. Lock `/install/`, set `config/config.php` outside web root if host allows

## RBAC

Enforced in `core/auth.php` (`RBAC_PAGES` + `require_page_access`).
