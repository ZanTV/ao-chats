# Railway Deployment — AO Chats Backend

## Step 1 — Railway service settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `backend` |
| **Start Command** | `node scripts/start-prod.mjs` (from `railway.toml`) |
| **Healthcheck** | `/health` |

Connect GitHub repo: `ZanTV/ao-chats` → branch `main`.

Custom domain: `api.aochats.chat` → Railway service.

---

## Step 2 — Environment variables (MOST COMMON FAILURE)

Copy **all** values from your local `backend/.env.production` into Railway:

**Railway Dashboard → your service → Variables → Raw Editor** → paste entire file → Save.

Or from terminal (after `railway login` + `railway link`):

```bash
cd backend
npm run railway:sync-env
```

### Required variables

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon **pooled** URL |
| `DATABASE_URL_UNPOOLED` | Neon direct URL (optional — auto-copied if missing) |
| `REDIS_URL` | Upstash `rediss://...` |
| `JWT_SECRET` | Strong random secret |
| `JWT_REFRESH_SECRET` | Strong random secret |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail App Password (use quotes if it contains spaces) |
| `CLIENT_URL` | `https://www.aochats.chat` |
| `CORS_ORIGIN` | `https://www.aochats.chat` |
| `SOCKET_CORS_ORIGIN` | `https://www.aochats.chat` |

Check locally before deploy:

```bash
cd backend
npm run railway:check
```

---

## Step 3 — Deploy

Push to `main` on GitHub — Railway redeploys automatically.

Or: Railway Dashboard → **Deploy** → **Redeploy**.

---

## Step 4 — Verify

```bash
curl https://api.aochats.chat/health
```

Expected: HTTP **200** with `"database":"connected"`.

---

## If deploy fails — read Deploy Logs

| Log message | Fix |
|-------------|-----|
| `Railway production env check failed` | Missing variables — Step 2 |
| `DATABASE_URL_UNPOOLED` / P1012 | Fixed in latest code — redeploy from `main` |
| `Healthcheck failure` | Server crashed — check env vars above |
| `Environment configuration failed` | JWT or SMTP missing / placeholder values |

---

## Quick checklist

- [ ] Root Directory = `backend`
- [ ] All variables from `.env.production` in Railway
- [ ] `JWT_REFRESH_SECRET` set (not placeholder)
- [ ] Latest code pushed to GitHub `main`
- [ ] `/health` returns 200
