# AO Chats v2.0 — Environment Configuration Report

Generated: 2026-08-07

## Summary

Development and production environments are now separated. The backend loads `.env.development` or `.env.production` based on `NODE_ENV`. Production code paths never fall back to localhost URLs. Missing variables produce explicit startup errors.

---

## Development Environment Status

| Item | Status |
|------|--------|
| Env loader | ✓ `backend/src/config/loadEnv.ts` |
| Dev template | ✓ `backend/.env.development.example` |
| Legacy fallback | ✓ `.env` still supported when `NODE_ENV=development` |
| Local defaults | ✓ PostgreSQL `localhost:5432`, Redis `localhost:6379`, API `localhost:3001` |
| Validation | ✓ `npm run validate-env` passes with current `.env` |
| Mobile dev template | ✓ `mobile/.env.development.example` |
| Mobile localhost | ✓ Allowed only when `EXPO_PUBLIC_ENV=development` |

**Local setup**

```bash
cp backend/.env.development.example backend/.env.development
cp mobile/.env.development.example mobile/.env.development
cd backend && npm run dev
cd mobile && npx expo start
```

---

## Production Environment Status

| Item | Status |
|------|--------|
| Env loader | ✓ Loads `.env.production` only (never legacy `.env`) |
| Prod template | ✓ `backend/.env.production.example` |
| Localhost guard | ✓ Throws if production URLs contain `localhost` / `127.0.0.1` |
| Hardcoded URLs removed | ✓ From `config/index.ts`, `mobile/config.ts`, `cors.ts` |
| Mobile prod template | ✓ `mobile/.env.production.example` |
| EAS build env | ✓ `mobile/eas.json` |
| Vercel build env | ✓ `vercel.json` + `mobile/vercel.json` |

**Production startup validation**

```bash
cd backend && npm run validate-env:prod
```

---

## Railway Variables

Required in Railway dashboard (`NODE_ENV=production` is set in `railway.toml`):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `REDIS_URL` | ✓ | Must not use localhost |
| `JWT_SECRET` | ✓ | Must not use default dev value |
| `JWT_REFRESH_SECRET` | ✓ | Reserved for refresh-token signing |
| `SMTP_HOST` | ✓ | Email verification |
| `SMTP_PORT` | ✓ | Typically `587` |
| `SMTP_USER` | ✓ | |
| `SMTP_PASS` | ✓ | |
| `CLIENT_URL` | ✓ | `https://www.aochats.chat` |
| `API_URL` | ✓ | `https://api.aochats.chat` |
| `SOCKET_URL` | ✓ | `https://api.aochats.chat` |
| `SOCKET_CORS_ORIGIN` | ✓ | `https://www.aochats.chat` |
| `OBJECT_STORAGE_ENDPOINT` | Optional | Future file uploads |
| `OBJECT_STORAGE_BUCKET` | Optional | Future file uploads |

Validate on Railway after deploy:

```bash
npm run validate-env:prod -- --check
```

---

## Vercel Variables

Required for web export builds:

| Variable | Set in `vercel.json` |
|----------|----------------------|
| `EXPO_PUBLIC_API_URL` | ✓ `https://api.aochats.chat/api` |
| `EXPO_PUBLIC_SOCKET_URL` | ✓ `https://api.aochats.chat` |
| `EXPO_PUBLIC_APP_URL` | ✓ `https://www.aochats.chat` |
| `EXPO_PUBLIC_STORAGE_URL` | ✓ `https://www.aochats.chat` |
| `EXPO_PUBLIC_ENV` | ✓ `production` |

EAS APK builds use the same variables in `mobile/eas.json`.

---

## Connection Validation

| Service | Status | Notes |
|---------|--------|-------|
| Database | ✓ (production API) | `/health` reports `database: connected` when Railway DB is reachable |
| Redis | ⚠ | Cache degrades gracefully if Redis unavailable |
| Socket.IO | ✓ | Same origin as `SOCKET_URL` / HTTP server |
| Auth / Registration / Email | ✓ | Requires SMTP + JWT vars on Railway |
| Chats / Messages / Notifications | ✓ | Require DB + API URL alignment |

Run local connection checks (with valid env file):

```bash
cd backend
npm run validate-env -- --check          # development
npm run validate-env:prod -- --check     # production
```

Production health endpoint: `GET https://api.aochats.chat/health`

---

## Environment Variables Loaded Successfully

| Component | Mechanism |
|-----------|-----------|
| Backend | `loadEnv.ts` → `validate.ts` → `config/index.ts` |
| Backend CLI | `npm run validate-env` / `validate-env:prod` |
| Mobile runtime | `mobile/src/services/config.ts` (`EXPO_PUBLIC_*`) |
| Mobile build | `app.config.js`, `eas.json`, Vercel `env` block |

Missing variable errors include the exact variable name and where to set it.

---

## Remaining Missing Variables (Action Required)

### Railway (set before next production deploy)

If not already in the Railway dashboard, add:

- `JWT_REFRESH_SECRET`
- `CLIENT_URL=https://www.aochats.chat`
- `API_URL=https://api.aochats.chat`
- `SOCKET_URL=https://api.aochats.chat`
- `SOCKET_CORS_ORIGIN=https://www.aochats.chat`
- Replace default `JWT_SECRET` with a strong production secret
- Ensure `REDIS_URL` points to Railway Redis (not `localhost`)

### Local development migration (recommended)

```bash
cp backend/.env backend/.env.development   # migrate legacy file
cp mobile/.env.development.example mobile/.env.development
```

Remove real credentials from committed example files (`.env.example` now contains templates only).

---

## Production Ready Status

| Check | Ready |
|-------|-------|
| Dev/prod env separation | ✓ |
| No localhost in production code | ✓ |
| Env validation on startup | ✓ |
| Mobile env-driven URLs | ✓ |
| Railway variable checklist | ⚠ Set missing vars above |
| Vercel/EAS variables | ✓ Configured in repo |
| Redeploy backend after Railway update | ☐ Pending |
| Rebuild EAS APK after env changes | ☐ Pending |

**Verdict:** Code and configuration structure are production-ready. Complete Railway variable setup and redeploy to activate full production validation.

---

## Files Changed

- `backend/src/config/loadEnv.ts` — environment file loader
- `backend/src/config/validate.ts` — validation rules + Railway checklist
- `backend/src/config/index.ts` — validated config (no prod localhost fallbacks)
- `backend/src/config/cors.ts` — removed hardcoded production origins
- `backend/scripts/validate-env.ts` — CLI validation + optional `--check`
- `backend/.env.development.example`, `.env.production.example`, `.env.example`
- `mobile/src/services/config.ts` — env-only production URLs + `getStorageUrl()`
- `mobile/app.config.js` — dev-only localhost fallbacks in `extra`
- `mobile/.env.development.example`, `.env.production.example`, `.env.example`
- `mobile/eas.json`, `mobile/vercel.json`, `vercel.json` — `EXPO_PUBLIC_STORAGE_URL`
- `.gitignore`, `backend/.gitignore` — ignore `.env.development` / `.env.production`
