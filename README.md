# Sales CRM

Custom **Sales & Production CRM** per the project blueprint: **PHP 8.2+**, **MySQL 8**, **Tailwind**, **HTMX**, **Alpine.js**, cPanel-ready.

See [docs/BLUEPRINT.md](docs/BLUEPRINT.md) for module-to-code mapping.

## Workflow

1. **Lead Finer** — Enters lead details and assigns to a seller.
2. **Seller** — Calls/emails from **My Leads** (organized contact info).
3. **Client response** — Logged per conversation (channel, outcome, summary).
4. **Win** — Create **invoice** with line items; mark paid to auto-create **project**.
5. **Routing** — Project routes by service category:
   - Design categories → Design department / Design Head
   - Development categories → Development department / Dev Head
6. **Assignment** — Head assigns juniors with written instructions.
7. **Delivery** — Developer/designer submits work → **seller notified** to contact client.
8. **Revisions** — Seller opens new revision; full **date-wise revision history**.
9. **Close** — Seller closes project when client is satisfied.
10. **Financial** — Refund / chargeback status; **upsells** added to project budget.

## Roles

| Role | Access |
|------|--------|
| Administrator | Full system, users, reports, settings |
| Lead Finer | Create & assign leads |
| Seller | Leads, clients, invoices, projects, upsell, close |
| Design / Dev Head | Department queue, assign team |
| Designer / Developer | My tasks, submit work |

## Extra features included

- In-app **notifications**
- **Audit log** (database table)
- **Project budget** lines (original, upsell, refund)
- **Status history** on projects
- **Reports** dashboard (admin)
- **Clients** directory
- Lead **activity** trail
- Priority flags on leads

## cPanel deployment

### 1. Upload files

Upload the entire project folder to `public_html` or a subfolder (e.g. `public_html/crm`).

### 2. Create MySQL database

In cPanel → **MySQL Databases**:

- Create database (e.g. `username_crm`)
- Create user and add **ALL PRIVILEGES**
- Note host (usually `localhost`), database name, user, password

### 3. Run installer

Open in browser:

`https://yourdomain.com/crm/install/`

Fill in database credentials, your public URL, and admin account.

### 4. Secure after install

- Delete or password-protect the `install/` folder
- Ensure `config/config.php` is not web-accessible (`.htaccess` blocks `config/`)

### 5. Create team users

Log in as admin → **Team** → add:

- Lead finers (role: Lead Finer)
- Sellers (role: Seller)
- Design Head → department: **Design**
- Designers → department: Design, manager: Design Head
- Development Head → department: **Development**
- Developers → department: Development, manager: Dev Head

## Local development (optional)

Use XAMPP/WAMP or PHP built-in server:

```bash
cd "f:\CRM for sales"
php -S localhost:8080
```

Set `app_url` in config to `http://localhost:8080` and create DB manually from `database/schema.sql` if not using installer.

## File structure

```
├── index.php          # Main router
├── install/           # One-time setup
├── config/            # config.php (created by installer)
├── database/schema.sql
├── includes/          # Auth, helpers, layout
├── views/             # Pages
├── actions/           # POST handlers
└── assets/            # CSS & JS
```

## Configuration

Edit via **Settings** (admin) or `config/config.php`:

- Company name, tax rate, currency
- Lead / invoice / project code prefixes

## Technology

- PHP 8.0+ recommended (7.4+ with minor adjustments)
- MySQL 5.7+ / MariaDB 10.3+
- No Composer required — easy cPanel upload

## Security notes

- Passwords hashed with `password_hash()`
- CSRF tokens on forms
- Prepared PDO statements
- Sensitive folders blocked via `.htaccess`

Change the default admin password immediately after install.

## PDF invoices, email & file uploads

- **PDF** — On Invoices, click **PDF** to download (uses bundled FPDF in `lib/fpdf/`).
- **Email invoice to client** — Click **Email** (requires SMTP configured in Settings).
- **SMTP alerts** — Settings → SMTP + “email notifications”; mirrors in-app alerts to user mailboxes.
- **Revision proofs** — Juniors upload PDF/images/zip when submitting work (max 10MB each); files appear on the revision ledger.

**Existing database:** run `database/migrations/003_email_uploads.sql` in phpMyAdmin.

**cPanel SMTP example:** Host `mail.yourdomain.com`, port `587`, TLS, full email as username, mailbox password.

## Invoice branding & BCC

**Settings → Invoice branding:** upload logo, company address, bank details (IBAN, SWIFT, etc.), payment terms.

**Settings → SMTP & BCC:** enable BCC and add comma-separated addresses (e.g. `billing@company.com, ceo@company.com`). All outbound mail—including invoice emails and CRM alerts—will copy those addresses when BCC is enabled.

**Existing database:** run `database/migrations/004_branding_bcc.sql` in phpMyAdmin.
