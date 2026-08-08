# Render 502 — Quick Fix Checklist

If `https://api.aochats.chat/health` shows **502 Bad Gateway**, the backend on Render is down or redeploying.

## Why 502 keeps coming back

| Cause | What happens |
|-------|----------------|
| **Failed deploy** | Render header `x-render-routing: no-deploy` — no live server |
| **Wrong Start Command** | Dashboard still uses `start-prod.mjs` with env check that exits before API starts |
| **Health check too slow** | Render kills the service if `/health` waits on DB during cold start |
| **Free tier sleep** | After ~15 min idle, first request can 502 for 30–90s while waking |
| **Many git pushes** | Each push redeploys; during deploy the site briefly shows 502 |

This was **not** a Vercel problem — the web app cannot load data when the Render API is down.

## Fix in Render Dashboard (do this now)

Your service uses **Docker** (not Native Node), so you will see **Dockerfile path** and **Docker Command** — not Build/Start Command.

Open **Render → ao-chats-api → Settings**:

### Build (Docker)

| Setting | Value |
|---------|--------|
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Dockerfile Path** | `Dockerfile` |
| **Registry Credential** | *(leave empty — uses GitHub)* |
| **Build Filter** | *(leave empty)* |

### Deploy

| Setting | Value |
|---------|--------|
| **Docker Command** | *(leave empty — uses Dockerfile `CMD`)* |

Or, if Render requires a value:

```text
node dist/index.js
```

### Health check

**Settings → Health & Alerts** (or similar):

| Setting | Value |
|---------|--------|
| **Health Check Path** | `/health/live` |

### Environment (CRITICAL after plan change)

When upgrading to **Starter** or recreating the service, **environment variables are often lost**.

Render → **Environment** → paste **every** variable from `backend/.env.production`:

- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `CLIENT_URL`, `CORS_ORIGIN`, `SOCKET_CORS_ORIGIN`

Missing vars → `dynamic-paid-error` / **502** until restored.

Then **Manual Deploy → Deploy latest commit**.

---

### Alternative: switch to Native Node (optional)

If you prefer **Build Command** / **Start Command** fields:

1. Create a **new Web Service** on Render
2. Choose **Language: Node** (not Docker)
3. Root Directory: `backend`
4. Build: `npm install && npm run build`
5. Start: `node dist/index.js`
6. Health: `/health/live`
7. Move env vars + custom domain `api.aochats.chat` to the new service

---

### Old Native Node table (only if runtime = Node, not Docker)

| Setting | Must be |
|---------|---------|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/index.js` |
| **Health Check Path** | `/health/live` |

## Verify

```bash
curl https://api.aochats.chat/health/live
# expect: {"status":"live",...}

curl https://api.aochats.chat/health
# expect: database connected
```

Web app: hard refresh `https://www.aochats.chat` after API is live.

## Optional: reduce sleep (paid)

Render **Starter** plan ($7/mo) keeps the service always on — no spin-down 502 on first visit.
