# AO Chats v2.0 — Production Authentication Recovery Report

**Date:** August 7, 2026  
**Status:** Fixes implemented — deploy backend to Railway + rebuild mobile for full production recovery

---

## Root Cause

### 1. Login: “Please verify your email first” (verified users blocked)

| Cause | Explanation |
|-------|-------------|
| **`emailVerified` vs `isVerified`** | Login only checks `emailVerified`. Profile badge (`isVerified`) is unrelated. |
| **Dev vs production database split** | Dev build hits `localhost`/LAN API; APK/Web hit `https://api.aochats.chat` — different PostgreSQL databases. |
| **Broken verification rows** | Some users completed verification (codes cleared) but `email_verified` stayed `false` due to older deploys or interrupted updates. |

**Fix:** Login auto-repairs users with `emailVerifyCode = null` and `emailVerifyExpiry = null` but `emailVerified = false`. Added one-time backfill script for bulk repair.

### 2. Registration: “Invalid input: expected string, received undefined”

| Cause | Explanation |
|-------|-------------|
| **Strict Zod schema** | `university` and `avatarId` were required strings; missing keys produced Zod’s raw `expected string, received undefined`. |
| **Schema vs service mismatch** | Service already defaulted `avatarId` and optional `university`; validation was stricter. |
| **Generic error surfacing** | Mobile showed Zod internals instead of field names. |

**Fix:** Schema defaults (`Other`, `avatar-1`), `required_error` messages, `formatValidationErrors()`, mobile always sends defaults.

### 3. Production vs development differences

| Area | Development | Production |
|------|-------------|------------|
| API URL | `http://localhost:3001/api` or LAN | `https://api.aochats.chat/api` |
| Database | Local `.env` `DATABASE_URL` | Railway env `DATABASE_URL` |
| Email verify | Same DB as dev login | Must verify on production API |
| CORS | Often `*` | `https://www.aochats.chat` |

---

## Files Modified

### Backend

| File | Change |
|------|--------|
| `backend/src/modules/auth/auth.validation.ts` | Defaults for `university`/`avatarId`; email trim/lowercase; friendly validation helper |
| `backend/src/modules/auth/auth.service.ts` | Login email normalize; auto-repair verified users; `emailVerified` in responses |
| `backend/src/modules/auth/auth.routes.ts` | Meaningful register validation errors + `VALIDATION_ERROR` code |
| `backend/src/middleware/validation.ts` | Consistent validation error format |
| `backend/scripts/backfill-email-verified.ts` | **NEW** — one-time DB repair |
| `backend/package.json` | `db:backfill-verified` script |

### Mobile

| File | Change |
|------|--------|
| `mobile/src/utils/validation.ts` | Human-readable API errors; no raw Zod strings |
| `mobile/src/stores/authStore.ts` | Normalize email on login |
| `mobile/app/(auth)/login.tsx` | Trim/lowercase email before login |
| `mobile/app/(auth)/register.tsx` | Default `university`/`avatarId`; clearer alert title |

---

## Validation Fixes

- Register accepts missing `university` → defaults to `"Other"`
- Register accepts missing `avatarId` → defaults to `"avatar-1"`
- Login/verify/forgot email: trim + lowercase
- API returns `{ error, code, details }` with readable `error` string

---

## Authentication Fixes

- Login repairs users who verified but flag was not saved
- Clearer `EMAIL_NOT_VERIFIED` message with resend guidance
- `emailVerified: true` included in login user payload
- Backfill script: `npm run db:backfill-verified` (run once on Railway after deploy)

---

## Prisma / Database Status

| Item | Status |
|------|--------|
| Schema | `emailVerified` + `isVerified` on `User` model |
| Migrations | Uses `prisma db push` on Railway deploy |
| Deploy command | `npx prisma db push --skip-generate && node dist/index.js` |
| Backfill | Optional `npm run db:backfill-verified` |

---

## Redis Status

- Optional in production (`REDIS_URL` on Railway)
- Auth does not depend on Redis — login/register work without cache

---

## Socket Status

- Production: `wss://api.aochats.chat` (via `EXPO_PUBLIC_SOCKET_URL`)
- Auth gate: JWT + `emailVerified` on socket connect (unchanged)
- Fixes ensure login succeeds so sockets can authenticate

---

## Environment Variables

### Frontend (EAS / Vercel — verified in config)

```
EXPO_PUBLIC_API_URL=https://api.aochats.chat/api
EXPO_PUBLIC_SOCKET_URL=https://api.aochats.chat
EXPO_PUBLIC_ENV=production
```

### Backend (Railway — verify in dashboard)

```
NODE_ENV=production
DATABASE_URL=...
JWT_SECRET=<strong secret, not default>
JWT_REFRESH_SECRET or JWT config
CLIENT_URL=https://www.aochats.chat
CORS_ORIGIN=https://www.aochats.chat
SOCKET_CORS_ORIGIN=https://www.aochats.chat
REDIS_URL=...
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
```

Remove duplicate `CORS_ORIGIN=*` in Railway if present (should be production domain only).

---

## Build Verification

| Check | Result |
|-------|--------|
| Backend `tsc --noEmit` | ✅ Pass |
| Mobile `tsc --noEmit` | ✅ Pass |
| Android export (prior) | ✅ 1819 modules |
| expo-doctor | ✅ 21/21 (when network available) |

---

## Deployment Checklist

### Railway (backend)

1. Push commit to GitHub → Railway auto-deploys
2. Confirm `/health` returns `database: connected`
3. Run once: `npm run db:backfill-verified` (Railway shell)
4. Test `POST /api/auth/login` with a verified user

### Vercel (web)

1. Redeploy from GitHub (or auto on push)
2. Test register → verify → login at https://www.aochats.chat

### EAS (APK)

1. `cd mobile && npm run build:android:preview`
2. Install APK and test full auth flow against production API

---

## End-to-End Test Checklist

- [ ] Register new account (production web)
- [ ] Receive verification email
- [ ] Enter 6-digit code
- [ ] Login succeeds
- [ ] Logout + login again
- [ ] Existing user (previously blocked) can login after backfill
- [ ] APK: same flow
- [ ] Send/receive message after login
- [ ] Socket connects (no auth errors in logs)

---

## Production / APK / Web Status

| Platform | Before | After deploy |
|----------|--------|--------------|
| **Production Web** | Auth broken | ✅ Expected fixed after Railway + Vercel deploy |
| **Production APK** | Auth broken | ✅ Expected fixed after new EAS build + Railway deploy |
| **Expo Dev Build** | Working | ✅ Unchanged (uses dev API) |

---

## Deployment Status

- **Code fixes:** ✅ Complete locally
- **Git commit/push:** Pending user push to trigger Railway/Vercel
- **Railway:** Redeploy required
- **Vercel:** Redeploy required
- **EAS APK:** New build recommended
