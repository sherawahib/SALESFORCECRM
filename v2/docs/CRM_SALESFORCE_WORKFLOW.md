# Salesforce-style CRM workflow

## Pipeline

```
Lead Finder → submits lead + auto-creates Project (prospect)
       ↓
Sales Manager → reviews queue, assigns Project Manager, creates invoices on project
       ↓
Project Manager → client calls, logs client revisions on project hub
       ↓
Accounts → records payment → project enters delivery (Production heads assign juniors)
       ↓
Project completed → lifecycle closed
```

## Roles

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Lead Finder** | Submit lead info | Invoice, assign PM, production |
| **Sales Manager** | Manager queue, assign PM, **invoices**, **upsells**, close project, refund/chargeback | Assign revisions, dialer |
| **Project Manager** | Dialer, client revisions, **assign each revision to designer or developer** | Invoices, upsells, close, refund/chargeback |
| **Design / Dev Head** | Approve work; **change default designer/developer** on a project anytime | Invoices, upsells, PM revision assign |
| **Production** | Fulfill revisions, assign juniors | Sales pipeline |

## Project hub

Every lead gets one **Project** at submission. All invoices and revisions attach to that project until `completed`.

UI: `/projects/{id}` — Production board · Invoices · Account

**Sales Manager-only controls** (bottom of Production board): Close project, Escalate refund/chargeback → Accounts approves and freezes production.

**Revision routing:**
- **PM** opens revision → picks department → revision status `pending_head_assignment` → **Design/Dev Head** assigns junior in Production → **Head queue**.
- **Client revision** — department must match project category (design-only / dev-only / combo).
- **Additional revision** — PM may route to **Design** or **Development** on any project; head assigns junior (`?anyDepartment=1` on crew list).
- **First delivery** (`pending_assignment`): **Production Manager** assigns initial work — Design/Dev heads do not pick juniors on the Projects tab.
- Heads assign juniors only via **Head queue** (PM revisions) or change default crew after initial delivery has started.

## Test accounts

- `sales.lead_finder@ops.test` / `demo123`
- `sales.sales_manager@ops.test` / `demo123`
- `sales.project_manager@ops.test` / `demo123`
