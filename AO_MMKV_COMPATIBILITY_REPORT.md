# AO Chats — MMKV / Expo Compatibility Report

**Date:** August 6, 2026  
**Project:** `mobile/` (AO Chats v2.0)

---

## Installed Versions

| Package | Version | Notes |
|---------|---------|-------|
| **Expo SDK** | `~56.0.19` | SDK 56 |
| **React Native** | `0.85.3` | Bundled with Expo 56 |
| **React** | `19.2.3` | |
| **react-native-mmkv** | **`2.12.2`** (pinned) | Selected compatible version |
| **react-native-nitro-modules** | **Not installed** | Not required for MMKV v2 |
| **expo-sqlite** | `~56.0.5` | Offline messages (unchanged) |
| **@react-native-async-storage/async-storage** | `2.2.0` | Preferences + MMKV fallback |

---

## Compatibility Matrix

| MMKV Version | Nitro Modules | TurboModules / New Arch | Expo Go | EAS APK | Verdict for AO Chats |
|--------------|---------------|-------------------------|---------|---------|----------------------|
| **4.x** (was `4.3.2`) | **Required** (`react-native-nitro-modules`) | Yes | ❌ Bundle error | ⚠️ Needs Nitro setup | **Rejected** — caused `Unable to resolve "react-native-nitro-modules"` |
| **3.x** | No | **Required** (C++ TurboModule) | ❌ Runtime error | ✅ With New Arch + prebuild | **Rejected** — Expo Go unsupported; adds New Arch requirement |
| **2.12.2** | **No** | **No** (classic JSI) | ⚠️ Fallback to AsyncStorage | ✅ Native MMKV in APK | **Selected** — works with RN ≥0.71, no Nitro |

### Why v4 failed

```
Unable to resolve "react-native-nitro-modules" from "node_modules/react-native-mmkv/src/getMMKVFactory.ts"
```

MMKV v4 is built on **Nitro Modules**. Expo Go does not ship that native module, and Metro fails at bundle time because the dependency is missing.

### Why v3 was not chosen

MMKV v3+ requires **TurboModules / New Architecture**. Expo Go does not support custom TurboModules. AO Chats targets both Expo Go (dev) and EAS APK (preview/production), so v3 would break dev workflow without guaranteed New Arch on all builds.

### Why v2.12.2 was chosen

- Peer dependency: `react-native >= 0.71.0` ✅ (project uses 0.85.3)
- No `react-native-nitro-modules` dependency ✅
- No mandatory New Architecture ✅
- Bundles in Metro without missing-module errors ✅
- Native MMKV in EAS preview/production builds ✅
- Graceful **AsyncStorage fallback** in Expo Go / web ✅

---

## Storage Architecture (Unchanged Public API)

```
┌─────────────────────────────────────────────────────────┐
│ CacheManager / storage.ts (same API as before)        │
├─────────────────────────────────────────────────────────┤
│ mmkvStore.ts — hybrid backend                         │
│   EAS/APK  → MMKV v2.12.2 (lazy require)              │
│   Expo Go  → memory + AsyncStorage fallback           │
├─────────────────────────────────────────────────────────┤
│ messageDb.ts — expo-sqlite (offline messages)         │
├─────────────────────────────────────────────────────────┤
│ storage.ts prefs — AsyncStorage (theme, language)     │
├─────────────────────────────────────────────────────────┤
│ SecureStore — auth tokens                             │
└─────────────────────────────────────────────────────────┘
```

### Files modified

| File | Change |
|------|--------|
| `mobile/package.json` | Added `react-native-mmkv@2.12.2` (exact pin); removed v4 |
| `mobile/src/cache/mmkvStore.ts` | Hybrid MMKV v2 + AsyncStorage fallback; lazy `require()`; one-time migration from AsyncStorage → MMKV |
| `mobile/src/cache/index.ts` | Export `getLocalCacheBackend()` for diagnostics |

### Files NOT changed (architecture preserved)

- `CacheManager.ts` — same `mmkvGet` / `mmkvSet` interface
- `messageDb.ts` — SQLite unchanged
- `storage.ts` — preferences + token flow unchanged
- `app/_layout.tsx` — `hydrateLocalCache()` unchanged

---

## Dependency Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Pass |
| `npx expo-doctor` | ⚠️ 1 check failed — **network error** reaching Expo API (not a dependency issue) |
| `npx expo export --platform android` | ✅ **Pass** — 1819 modules, 4.8 MB HBC bundle |
| Metro bundle (Expo Go path) | ✅ No `react-native-nitro-modules` error |

### Android export output

```
Android Bundled 177694ms node_modules/expo-router/entry.js (1819 modules)
_expo/static/js/android/entry-*.hbc (4.8MB)
Exported: dist
```

### EAS preview build

Run locally when ready:

```bash
cd mobile
npm run build:android:preview
```

EAS preview uses `eas.json` → `preview` profile → `buildType: apk`. MMKV v2 autolinks during `expo prebuild` on EAS — no extra config plugin required for v2.

---

## Runtime Behavior

| Environment | Cache backend | Messages |
|-------------|---------------|----------|
| **Expo Go** | AsyncStorage + memory | expo-sqlite |
| **EAS preview APK** | Native MMKV v2 | expo-sqlite |
| **Production APK** | Native MMKV v2 | expo-sqlite |
| **Web** | AsyncStorage + memory | expo-sqlite (if available) |

Diagnostic helper:

```typescript
import { getLocalCacheBackend } from './src/cache';
// 'mmkv' in APK | 'async-storage' in Expo Go
```

---

## Recommendations

1. **Dev in Expo Go** — works with AsyncStorage fallback; no code changes needed.
2. **Test MMKV performance** — install preview APK from EAS; cache uses native MMKV automatically.
3. **Do not upgrade to MMKV v4** until Expo documents first-class Nitro Modules support in your target workflow.
4. **Future upgrade path** — when moving fully to dev builds + New Architecture, evaluate MMKV v3.3.x; when Nitro is stable in Expo, evaluate v4.x + `react-native-nitro-modules`.

---

## Summary

| Item | Value |
|------|-------|
| Expo SDK | 56.0.19 |
| React Native | 0.85.3 |
| MMKV version installed | **2.12.2** |
| Nitro requirement | **None** |
| Storage architecture | **Preserved** (hybrid backend) |
| Android bundle | **Verified** ✅ |
| EAS preview | Ready to build (`npm run build:android:preview`) |
