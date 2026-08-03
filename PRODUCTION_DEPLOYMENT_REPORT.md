# AO Chats v2.0 — Production Deployment Report

**Domain:** https://www.aochats.chat  
**API:** https://api.aochats.chat  
**Date:** August 3, 2026

---

## Executive Summary

The AO Chats ecosystem has been configured for production deployment on **Vercel** (frontend/web), **Railway** (backend), **PostgreSQL** (Neon/Railway), and **Redis**. All runtime localhost dependencies have been removed from production code paths.

---

## Frontend Status ✅

| Item | Status | Details |
|------|--------|---------|
| API URL | ✅ | `EXPO_PUBLIC_API_URL` → `https://api.aochats.chat/api` |
| Socket URL | ✅ | `EXPO_PUBLIC_SOCKET_URL` → `https://api.aochats.chat` |
| App URL | ✅ | `EXPO_PUBLIC_APP_URL` → `https://www.aochats.chat` |
| Config | ✅ | `mobile/src/services/config.ts` — env-driven, no localhost in production |
| Socket client | ✅ | WebSocket + polling, reconnect, HTTPS |
| Deep linking | ✅ | `aochats://` scheme + Android App Links + iOS Associated Domains |
| APK ready | ✅ | `mobile/eas.json` production profile with env vars |
| Vercel web | ✅ | Root `vercel.json` with production env |

**Files created/updated:**
- `mobile/app.config.ts` — dynamic Expo config
- `mobile/.env.example` — production template
- `mobile/eas.json` — EAS Build for APK
- `mobile/src/services/config.ts`
- `mobile/src/services/socket.ts`

---

## Backend Status ✅

| Item | Status | Details |
|------|--------|---------|
| Express | ✅ | Production helmet, trust proxy, rate limiting |
| CORS | ✅ | `CLIENT_URL`, `CORS_ORIGIN`, `SOCKET_CORS_ORIGIN` |
| Health check | ✅ | `GET /health` — DB + Redis status |
| Socket.IO | ✅ | Multi-origin CORS, websocket + polling |
| Railway | ✅ | `backend/railway.toml` deploy config |
| Prisma | ✅ | `postinstall` generates client on deploy |
| JWT | ✅ | Required in production, rejects default secret |

**Files created/updated:**
- `backend/src/config/index.ts`
- `backend/src/config/cors.ts`
- `backend/src/index.ts`
- `backend/src/sockets/index.ts`
- `backend/src/config/redis.ts` — TLS for `rediss://`
- `backend/railway.toml`
- `backend/.env.example`

---

## Domain & SSL Status ⚠️ Manual DNS Required

| Domain | Purpose | Action Required |
|--------|---------|-----------------|
| `www.aochats.chat` | Frontend (Vercel) | CNAME → Vercel |
| `aochats.chat` | Redirect to www | CNAME or redirect |
| `api.aochats.chat` | Backend (Railway) | CNAME → Railway service |

**SSL:** Automatic via Vercel and Railway once DNS is configured.  
**HTTPS enforced:** Helmet HSTS enabled in production backend.

---

## PostgreSQL Status ✅

- Prisma ORM configured via `DATABASE_URL`
- No localhost references in production config
- Railway deploy runs `prisma db push` on start
- Neon pooled URL recommended for production

---

## Prisma Status ✅

- Schema includes all models (User, Message, Conversation, etc.)
- Indexes on `conversationId + createdAt`, `senderId`
- `postinstall: prisma generate` in backend package.json
- Foreign keys with cascade rules configured

---

## Redis Status ✅

- Production uses `REDIS_URL` (Railway Redis)
- TLS support for `rediss://` URLs
- Graceful fallback if unavailable
- Cache keys: users, conversations, messages, notifications

---

## Socket.IO Status ✅

| Feature | Status |
|---------|--------|
| WebSocket | ✅ |
| Polling fallback | ✅ |
| Reconnect | ✅ (20 attempts in production) |
| Heartbeat | ✅ 25s interval |
| JWT auth | ✅ |
| Typing | ✅ |
| Read receipts | ✅ |
| Real-time messages | ✅ |

---

## Railway Deployment Steps

1. Create Railway project → deploy from `backend/` folder
2. Add PostgreSQL plugin (or use Neon `DATABASE_URL`)
3. Add Redis plugin → copy `REDIS_URL`
4. Set environment variables from `backend/.env.example`
5. Add custom domain `api.aochats.chat`
6. Deploy — health check at `/health`

---

## Vercel Deployment Steps

1. Import repo → set root to project
2. Use `vercel.json` config (builds `mobile/` for web)
3. Add domain `www.aochats.chat`
4. Environment variables auto-set from `vercel.json`
5. Enable HTTPS (automatic)

---

## APK Build Steps

```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile production
```

Env vars are embedded via `eas.json` production profile.

---

## Environment Variables Checklist

### Frontend (EAS / Vercel)
- [x] `EXPO_PUBLIC_APP_NAME=AO Chats`
- [x] `EXPO_PUBLIC_APP_URL=https://www.aochats.chat`
- [x] `EXPO_PUBLIC_API_URL=https://api.aochats.chat/api`
- [x] `EXPO_PUBLIC_SOCKET_URL=https://api.aochats.chat`
- [x] `EXPO_PUBLIC_ENV=production`

### Backend (Railway)
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` (PostgreSQL)
- [ ] `REDIS_URL` (Redis TLS)
- [ ] `JWT_SECRET` (strong random)
- [ ] `CLIENT_URL=https://www.aochats.chat`
- [ ] `CORS_ORIGIN=https://www.aochats.chat,https://aochats.chat`
- [ ] `SOCKET_CORS_ORIGIN=https://www.aochats.chat,https://aochats.chat`
- [ ] `SMTP_*` credentials

---

## Security ✅

| Control | Status |
|---------|--------|
| HTTPS only (production) | ✅ |
| Helmet | ✅ |
| HSTS | ✅ |
| CORS restricted | ✅ |
| Rate limiting | ✅ (200 req/15min prod) |
| JWT validation | ✅ |
| Input validation (Zod) | ✅ |
| JWT secret enforcement | ✅ |
| Secure token storage (mobile) | ✅ expo-secure-store |

---

## Performance ✅

| Optimization | Status |
|--------------|--------|
| Redis cache | ✅ |
| Message cache (per-user) | ✅ |
| Socket.IO heartbeat | ✅ |
| Prisma indexes | ✅ |
| Pagination (messages) | ✅ |
| FlatList optimization | ✅ |

---

## Remaining Issues (Manual Steps)

1. **DNS configuration** — Point domains to Vercel and Railway
2. **Railway env vars** — Set all production secrets in dashboard
3. **JWT_SECRET** — Generate and set strong secret on Railway
4. **SMTP** — Configure production email credentials
5. **EAS project ID** — Run `eas init` and add to env if using APK builds
6. **api.aochats.chat** — Verify Railway custom domain + SSL
7. **Test end-to-end** on production URLs after DNS propagation

---

## Local Development (Unchanged)

Development still works locally:
- Copy `mobile/.env.development.example` → `mobile/.env`
- Backend `npm run dev` on port 3001
- Expo Go auto-detects LAN IP

Production builds **never** use localhost.

---

*End of report.*
