# TECH BY VISION CRM (v2)

Enterprise multi-department CRM (Node.js + Next.js + MySQL).

## Phases delivered

| Phase | Scope |
|-------|--------|
| **1** | Monorepo, Prisma schema, JWT auth, RBAC, admin API, Next.js shell + login |
| **2** | Sales (leads, invoices, dashboard) + Accounts (payments, approvals, reports) |
| **3** | Production (projects, assign, revisions) + DevOps (deployments) |
| **4** | IT (audit, tickets, integrations), global search, notifications |
| **5** | Commission preview stub, Docker Compose (MySQL + Redis), WebSocket hook |

## Quick start (local)

### 1. Database (SQLite — default, no MySQL needed)

```bash
cd v2
npm run db:push
npm run db:seed
```

For production MySQL: set `DATABASE_URL` in `apps/api/.env` and run `node apps/api/scripts/sqlite-schema.mjs` in reverse (use `schema.mysql.prisma` backup) or restore MySQL provider in `schema.prisma`.

### 2. API

```bash
cd v2
cp apps/api/.env.example apps/api/.env
# Edit DATABASE_URL if needed

npm install
npm run db:push
npm run db:seed
npm run dev:api
```

API: http://localhost:4000/health

### 3. Web

```bash
cp apps/web/.env.local.example apps/web/.env.local
npm run dev:web
```

Web: http://localhost:7777

### 4. Both

```bash
npm run dev
```

## Test logins (after seed)

**Password for every account:** `demo123`

Emails follow `{department}.{role_slug}@ops.test` — e.g. `sales.closer@ops.test`, `it.super_admin@ops.test`.

All 15 roles are listed on the **sign-in page** at http://localhost:7777/login (click a row or **Go** to sign in instantly).

## API routes

- `POST /api/v1/auth/login`
- `GET /api/v1/admin/*` — departments, users, settings
- `GET /api/v1/sales/*` — leads, invoices, dashboard
- `GET /api/v1/accounts/*` — invoices, payments, approvals
- `GET /api/v1/production/*` — projects, tasks, revisions
- `GET /api/v1/devops/deployments`
- `GET /api/v1/it/audit`, `/tickets`
- `GET /api/v1/search?q=`
- `GET /api/v1/notifications`

## PHP Phase 0

The original cPanel-friendly CRM remains in the repo root (`index.php`, `core/`, etc.). Run v2 in parallel and migrate department-by-department per `docs/ENTERPRISE_PLATFORM_PLAN.md`.
