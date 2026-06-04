# Deploy TECH BY VISION CRM — Vercel + Neon only

One deployment on **Vercel** (Next.js + API via serverless). Database on **Neon** (PostgreSQL).

No Render or other host required.

---

## Architecture

```
Browser → yourdomain.com (Vercel)
              ├── Next.js pages
              └── /api/* → Fastify (same Vercel project, serverless)
                        → Neon PostgreSQL
```

---

## 1. Neon

1. [neon.tech](https://neon.tech) → **New project**
2. Copy **pooled** connection string → `DATABASE_URL`
3. Copy **direct** connection string → `DIRECT_URL` (for `prisma db push`)

Both end with `?sslmode=require`

---

## 2. GitHub

Push `main` from this repo (schema uses `postgresql`).

---

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Import** `SALESFORCECRM`
2. **Root Directory:** `v2/apps/web`
3. Framework: **Next.js** (uses `vercel.json` in that folder)

### Environment variables

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** URL |
| `JWT_SECRET` | Random 32+ chars |
| `JWT_REFRESH_SECRET` | Random 32+ chars |
| `CRON_SECRET` | Random string (for scheduled call reminders) |
| `UPLOAD_DIR` | `/tmp/crm-uploads` |

4. **Deploy**

### First-time database

After first deploy, run locally (or Vercel CLI) once:

```bash
cd v2/apps/api
# set DATABASE_URL and DIRECT_URL in .env
npx prisma db push
npm run db:seed
```

Or use Neon SQL console after `db push` from your PC.

---

## 4. Namecheap domain

1. Vercel → Project → **Settings** → **Domains** → add `crm.yourdomain.com`
2. Namecheap → **Advanced DNS** → CNAME `crm` → value Vercel shows
3. Wait for SSL **Valid**

---

## 5. Local development

```bash
cd v2
cp apps/api/.env.example apps/api/.env
# For local SQLite: set provider sqlite in schema and DATABASE_URL=file:./dev.db

npm install
npm run db:push
npm run db:seed
npm run dev:web
```

Open http://localhost:7777 — API runs inside Next.js (no separate port).

Optional standalone API: `npm run dev:api` (port 4000).

---

## Notes

- **File uploads** on Vercel use `/tmp` (ephemeral). For permanent files use S3/R2 later.
- **Cron** runs every 15 minutes on Vercel (call reminders).
- Do not commit `.env` or secrets to GitHub.
