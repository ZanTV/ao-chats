# AO Chats v2.0 — Expo Startup Diagnostic & Recovery Report

**Date:** August 4, 2026  
**Status:** ✅ All checks passing

---

## ✓ Root Cause

Multiple issues combined — not a single crash, but **startup blockers and SDK incompatibilities**:

| # | Issue | Impact |
|---|-------|--------|
| 1 | **`@react-navigation/*` direct deps with Expo SDK 56** | Expo Router 56 is incompatible with standalone React Navigation packages. Caused dependency conflicts and potential runtime navigation failures. |
| 2 | **Nested `mobile/ao-chats/` template project** | Duplicate Expo scaffold inside the repo polluted TypeScript (`tsc` reported 30+ errors from wrong project) and risked Metro picking up wrong files. |
| 3 | **`StyleSheet.absoluteFillObject` in NotificationPanel** | Removed/renamed in React Native 0.85 — TypeScript error; could cause style issues at runtime in root layout. |
| 4 | **Auth init blocking startup (no timeout)** | APK/standalone builds pointed at production API; `fetch()` without timeout hung `initializeAuth()` → infinite LoadingScreen. *(Fixed in prior session)* |
| 5 | **TypeScript errors in app code** | `friends.tsx` SectionList union types, `register.tsx` API callback typing, socket event handlers — blocked clean builds and IDE tooling. |
| 6 | **Operational: port 8081 conflict** | Second `expo start` instance switches ports; not a code bug but confusing during testing. |

**Why Expo QR worked but APK hung:** Expo Go uses `__DEV__` + LAN backend auto-detection; APK uses production API with blocking auth init.

---

## ✓ Files Modified

| File | Change |
|------|--------|
| `package.json` | Removed `@react-navigation/*`; added `start:clear`, `doctor` scripts |
| `tsconfig.json` | Excluded `ao-chats`, `dist`, `dist-test` |
| `metro.config.js` | BlockList for nested `ao-chats/` folder |
| `NotificationPanel.tsx` | `absoluteFillObject` → `absoluteFill` |
| `app/chat/[id].tsx` | Fixed `useRef` timer type |
| `app/(tabs)/index.tsx` | Socket callback typing (`unknown` cast) |
| `app/(tabs)/friends.tsx` | SectionList generic union type fix |
| `app/(auth)/register.tsx` | Password strength API callback typing |
| `src/services/storage.ts` | Safe `globalThis` cast |
| `src/components/chat/SwipeableMessageRow.tsx` | ThemeColors alignment |

*(Prior session also fixed: `api.ts` timeouts, `authStore.ts` non-blocking init, `_layout.tsx` splash handling)*

---

## ✓ Packages Updated

**Removed (unused + incompatible with SDK 56):**
- `@react-navigation/bottom-tabs`
- `@react-navigation/native`
- `@react-navigation/native-stack`

**Kept aligned with Expo SDK 56:**
- `expo` ^56.0.0
- `expo-router` ~56.2.17
- `react-native` 0.85.3
- `react` 19.2.3
- `react-native-reanimated` 4.3.1
- `react-native-worklets` 0.8.3
- `typescript` ~6.0.3

---

## ✓ Expo SDK Status

```
npx expo-doctor → 21/21 checks passed ✅
npx expo install --check → Dependencies up to date ✅
npx expo export --platform android → Bundle OK (4.6MB) ✅
npx tsc --noEmit → 0 errors ✅
```

---

## ✓ Dependency Status

| Package | Version | Status |
|---------|---------|--------|
| Expo SDK | 56 | ✅ |
| React Native | 0.85.3 | ✅ |
| React | 19.2.3 | ✅ |
| Expo Router | ~56.2.17 | ✅ |
| Gesture Handler | ~2.31.1 | ✅ |
| Reanimated | 4.3.1 | ✅ |
| Worklets | 0.8.3 | ✅ |
| Safe Area Context | ~5.7.0 | ✅ |
| Screens | ~4.26.0 | ✅ |

---

## ✓ Navigation Status

- Entry: `expo-router/entry` (package.json `main`) ✅
- Root layout: `app/_layout.tsx` with AuthGuard ✅
- Initial route: `app/index.tsx` → login or tabs ✅
- No navigation loops detected ✅
- Tabs via `expo-router` Tabs (not @react-navigation) ✅

---

## ✓ Asset Status

| Asset | Path | Status |
|-------|------|--------|
| Icon | `assets/icon.png` | ✅ Present |
| Adaptive icon | `assets/adaptive-icon.png` | ✅ Present |
| Splash | `assets/splash.png` | ✅ Present |

Referenced in `app.config.js` — all exist.

---

## ✓ Environment Status

| Variable | Dev (Expo Go) | Production (APK) |
|----------|-----------------|------------------|
| `EXPO_PUBLIC_API_URL` | Auto LAN via `config.ts` | `https://api.aochats.chat/api` |
| `EXPO_PUBLIC_SOCKET_URL` | Auto LAN | `https://api.aochats.chat` |
| `EXPO_PUBLIC_ENV` | `development` (__DEV__) | `production` (eas.json) |

**Local dev:** Copy `.env.development.example` → `.env` if needed.  
**No `.env` required for Expo Go** — LAN detection works automatically.

---

## ✓ Remaining Issues

| Issue | Severity | Action |
|-------|----------|--------|
| Production API (`api.aochats.chat`) auth 500 errors | High | Redeploy Railway backend |
| Nested `mobile/ao-chats/` folder still on disk | Low | Safe to delete manually (excluded from build) |
| npm audit moderate vulnerabilities | Low | Run `npm audit fix` when convenient |
| New APK needed for mobile fixes | Medium | `npm run build:android:preview` |

---

## ✓ Production Readiness

| Check | Status |
|-------|--------|
| Expo starts | ✅ |
| Metro bundles | ✅ |
| TypeScript clean | ✅ |
| expo-doctor | ✅ 21/21 |
| Auth non-blocking | ✅ |
| API timeouts | ✅ |
| SDK 56 compatible | ✅ |

---

## How to Start

```bash
cd mobile

# Clean start (recommended)
npm run start:clear

# Or standard
npm run start

# Diagnostics
npm run doctor
```

**If port busy:** Stop other Metro instances or accept alternate port (8082).

**Expo Go:** Scan QR → app opens to login screen within ~2 seconds.

---

*AO Chats architecture preserved — no rewrite, no feature removal.*
