# Mobile — "Cannot reach the AO Chats server"

That message comes from `mobile/src/services/api.ts` when `fetch()` fails before getting an HTTP response (`NETWORK_ERROR`).

## Common causes

| Cause | Where to fix |
|-------|----------------|
| **CORS blocked** (web) — opened `aochats.chat` without `www` | Render: `CORS_ORIGIN` and `SOCKET_CORS_ORIGIN` must include **both** `https://www.aochats.chat,https://aochats.chat` |
| **Missing `EXPO_PUBLIC_*`** at Vercel/EAS build time | Vercel Dashboard → Environment Variables (see below) |
| **Local dev** — backend not running on `:3001` | Run `npm run dev` from repo root |
| **Render cold start** (>30s) | Wait and retry; free tier spins down when idle |

## Required in Git / Vercel / EAS

These must be set for **production** builds (`EXPO_PUBLIC_*` are baked in at build time):

```
EXPO_PUBLIC_APP_NAME=AO Chats
EXPO_PUBLIC_APP_URL=https://www.aochats.chat
EXPO_PUBLIC_API_URL=https://api.aochats.chat/api
EXPO_PUBLIC_SOCKET_URL=https://api.aochats.chat
EXPO_PUBLIC_STORAGE_URL=https://www.aochats.chat
EXPO_PUBLIC_ENV=production
```

Already in repo: `vercel.json`, `mobile/vercel.json`, `mobile/eas.json`.

Also add the same variables in **Vercel Dashboard → Project → Settings → Environment Variables** (Production).

## Required on Render (backend)

Update in Render → Environment:

```
CORS_ORIGIN=https://www.aochats.chat,https://aochats.chat
SOCKET_CORS_ORIGIN=https://www.aochats.chat,https://aochats.chat
```

Then redeploy the backend service.

## Verify

```bash
curl https://api.aochats.chat/health
```

Web: open https://www.aochats.chat (prefer `www`).
