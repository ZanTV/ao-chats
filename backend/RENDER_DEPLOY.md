# Render Deployment — AO Chats Backend

## Step 1 — Create Web Service on Render

1. https://dashboard.render.com → **New +** → **Web Service**
2. Connect GitHub repo: `ZanTV/ao-chats`
3. Settings:

| Setting | Value |
|---------|--------|
| **Name** | `ao-chats-api` (or your choice) |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node scripts/start-prod.mjs` |
| **Health Check Path** | `/health` |

Or use the repo **`render.yaml`** blueprint (Render → New → Blueprint).

---

## Step 2 — Environment variables

**Render Dashboard → your service → Environment** → paste from `backend/.env.production`.

Required:

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled PostgreSQL URL |
| `DATABASE_URL_UNPOOLED` | Neon direct URL (optional) |
| `REDIS_URL` | `rediss://...upstash.io:6379` |
| `JWT_SECRET` | Strong random secret |
| `JWT_REFRESH_SECRET` | Strong random secret |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail |
| `SMTP_PASS` | Gmail App Password |
| `CLIENT_URL` | `https://www.aochats.chat` |
| `CORS_ORIGIN` | `https://www.aochats.chat,https://aochats.chat` |
| `SOCKET_CORS_ORIGIN` | `https://www.aochats.chat,https://aochats.chat` |

**Do not set `PORT`** — Render injects it automatically.

Check locally before deploy:

```bash
cd backend
npm run render:check
```

---

## Step 3 — Custom domain

Render → **Settings → Custom Domains** → add `api.aochats.chat`

Update DNS (at your registrar):

| Type | Name | Value |
|------|------|-------|
| CNAME | `api` | your Render service URL (e.g. `ao-chats-api.onrender.com`) |

---

## Step 4 — Deploy & verify

Render deploys on every push to `main`. The API **starts immediately** for health checks; migrations run **in the background** after boot so cold starts do not cause **502 Bad Gateway**. To run migrations manually: `node scripts/migrate-deploy.mjs`.

```bash
curl https://api.aochats.chat/health
```

Expected: HTTP **200**, `"database":"connected"`.

---

## If deploy fails — read Logs

| Log message | Fix |
|-------------|-----|
| `Production environment check failed` | Missing env vars — Step 2 |
| `DATABASE_URL_UNPOOLED` / P1012 | Redeploy latest code from `main` |
| Health check failed | Server crashed — check env vars |
| `Environment configuration failed` | JWT/SMTP missing or placeholder values |

---

## Files changed for Render (in this repo)

| File | Purpose |
|------|---------|
| `render.yaml` | Render blueprint (build/start/health) |
| `backend/src/config/platform.ts` | Detects Render (`RENDER=true`) |
| `backend/src/config/loadEnv.ts` | Skips local `.env` on Render |
| `backend/scripts/production-preflight.mjs` | Validates env before start |
| `backend/scripts/start-prod.mjs` | Production start (Render start command) |
| `backend/Dockerfile` | Optional Docker deploy |
| `backend/.env.production.example` | Template for Render Environment |
