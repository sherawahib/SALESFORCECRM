# Vercel environment checklist (TECH BY VISION CRM)

After Neon is seeded, add these in **Vercel → your project → Settings → Environment Variables**.

Enable for **Production**, **Preview**, and **Development**.

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Your Neon **pooled** PostgreSQL URL (`?sslmode=require`) |
| `JWT_SECRET` | Same as in `v2/apps/api/.env` (or generate new 32+ char string) |
| `JWT_REFRESH_SECRET` | Same as in `v2/apps/api/.env` |
| `CRON_SECRET` | Same as in `v2/apps/api/.env` |
| `UPLOAD_DIR` | `/tmp/crm-uploads` |

**Do not add** `API_INTERNAL_URL` — the API runs inside this Vercel project.

## Vercel project settings

| Setting | Value |
|---------|--------|
| Root Directory | **`v2`** (not `v2/apps/web` — monorepo needs full `v2` folder) |

If the project was created with `v2/apps/web`, change it: **Settings → General → Root Directory** → `v2` → Save → Redeploy.

Alternatively set Root Directory to **repo root** (empty) and use root `vercel.json` in the repository.
| Framework | Next.js |
| Build Command | (from `vercel.json`) `cd ../.. && npm run vercel-build` |
| Install Command | `cd ../.. && npm install` |

## After saving env vars

1. **Deployments** → latest deployment → **⋯** → **Redeploy**
2. Test: `https://YOUR-PROJECT.vercel.app/api/health` → should return `{"ok":true,...}`
3. Open `https://YOUR-PROJECT.vercel.app/login`

## First login (after seed)

Use any seeded account, e.g. `it.super_admin@ops.test` with password `demo123` — **change passwords immediately** in production.

## Namecheap custom domain

Vercel → **Domains** → add your domain → update Namecheap CNAME as shown.

## Security

- Never commit `apps/api/.env` to GitHub.
- If your database password was shared publicly, **reset it in Neon** and update Vercel `DATABASE_URL`.
