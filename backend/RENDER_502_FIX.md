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

Open **Render → ao-chats-api → Settings**:

| Setting | Must be |
|---------|---------|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/index.js` |
| **Health Check Path** | `/health/live` |

Then **Environment** — paste all vars from `backend/.env.production` (never commit that file).

Click **Manual Deploy → Deploy latest commit**.

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
