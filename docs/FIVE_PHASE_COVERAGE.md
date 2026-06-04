# 5-Phase Lifecycle — Coverage Map

This document maps your blueprint to **PHP (cPanel)** and **v2 (Node)**. Nothing was removed; gaps were filled.

## Phase 1: Lead Ingestion

| Blueprint | PHP | v2 |
|-----------|-----|-----|
| Single form | views/leads, actions | `/sales` Submit lead tab |
| CSV bulk upload | `dashboards/lead_import.php` | `POST /api/v1/sales/leads/import` |
| Sanitize (`htmlspecialchars`) | `core/lead_parser.php` | Zod + Prisma |
| INSERT status `new` | LeadService / parser | `pending_manager` + auto **project** |
| Preview grid | lead_import UI | CSV result `{ imported, errors }` |

**v2 + Salesforce flow:** Lead Finder cannot assign production or invoice — records go to **Sales Manager queue**.

## Phase 2: Sales Dialing Queue

| Blueprint | PHP | v2 |
|-----------|-----|-----|
| Queue SQL filter | `seller_queue_leads()` | `GET /sales/leads?queue=dialer` (PM) |
| HTMX instant outcomes | `actions/api.php` | `POST /sales/leads/:id/call` |
| No answer / voicemail | log_quick_call | same |
| Not interested → archive | same | `isArchived` |
| Ready to purchase | status won | `active` + invoice on **project hub** (manager) |

**Roles:** PHP uses Seller/Closer; v2 uses **Project Manager** for dialer on assigned leads. Manager creates invoices.

## Phase 3: Finance & Project Automation

| Blueprint | PHP | v2 |
|-----------|-----|-----|
| Invoice modal categories | views/invoices | Project hub → Invoices tab |
| Paid → project | `core/project_allocator.php` → `create_projects_from_paid_invoice` | `createProjectsFromInvoice` → `activateProjectOnPayment` |
| Payment clearance | accounts payments | `POST /accounts/payments` |

**v2:** Project exists from Phase 1; payment **activates delivery** on same project (no duplicate card).

## Phase 4: Production & Revision Loop

| Blueprint | PHP | v2 |
|-----------|-----|-----|
| Head assign junior | project_view assign | `POST /production/projects/:id/assign` |
| Submit → review_pending | submit_work | `POST /production/tasks/:id/submit` |
| Head approve → client_review | head_approve | `POST /production/revisions/:id/approve` |
| Open revision | `core/open_revision.php` | `POST /projects/:id/open-revision` |
| MAX(revision_number)+1 | next_revision_number | `services/revisions.ts` |
| Upsell budget formula | recalculate_project_budget | `services/budget.ts` |
| PM client revision | seller open_revision | `POST /projects/:id/client-revision` |
| Mark client notified | seller_notified | `POST /projects/:id/revisions/:revId/client-notified` |

## Phase 5: Closure & Exceptions

| Blueprint | PHP | v2 |
|-----------|-----|-----|
| Close project | close_project action | `POST /projects/:id/close` |
| Refund / chargeback | financial_status | `POST /projects/:id/financial-exception` → approval |
| freeze_assets | `core/freeze_assets.php` | `services/freeze.ts` on approval |
| Audit CRITICAL_* | audit_log | `audit` table |

## UI Layouts

| Blueprint | PHP | v2 |
|-----------|-----|-----|
| Sales workspace split pane | `seller_workspace.php` | `/sales` + PM dialer tab |
| Production board (budget top, revisions middle) | `project_view.php` | `/projects/[id]` |

## Engine files (PHP)

- `core/lead_parser.php`
- `core/project_allocator.php`
- `core/open_revision.php`
- `core/freeze_assets.php`

These wrap existing `LeadService` / `project_helpers` logic.
