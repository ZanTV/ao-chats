# AO Chats — Reanimated Invalid RGBA Fix Report

**Date:** August 6, 2026  
**Issue:** Animated `rgba()` strings with scientific-notation alpha values (e.g. `8.15852752200641e-7`) causing Reanimated / React Native warnings and broken highlight animations.

---

## Root Cause

In `MessageBubble.tsx`, the jump-to-message highlight animation used:

```typescript
backgroundColor: `rgba(37, 99, 235, ${highlight.value * 0.22})`
```

`highlight.value` is driven by `withTiming(0, { duration: 2200 })` after peaking at `1`. As the value decays toward zero, Reanimated produces sub-normal floating-point numbers. When embedded in a template literal, JavaScript stringifies these as **scientific notation** (e.g. `8.15852752200641e-7`), which is **not a valid CSS/RN rgba alpha** and triggers runtime warnings.

### Why other animations were safe

| Component | Animated property | Status |
|-----------|-------------------|--------|
| **Message Bubble highlight** | `backgroundColor: rgba(..., ${value})` | **BUG — fixed** |
| **Swipe Reply hint** | `opacity` (numeric) | Low risk; hardened with `clampOpacity` |
| **Notification Panel overlay** | `opacity` via `interpolate` + CLAMP | Safe; hardened with `clampOpacity` |
| **Pinned Bar** | `translateX` only | No color animation |
| **Reply Bubble** | Static rgba strings | Not animated |
| **Selected Message** | Static hex alpha (`primary + '08'`) | Not animated |
| **Reaction Modal** | Modal fade, static overlay rgba | Not Reanimated |
| **Theme / Navigation** | Expo Router stack animations | No custom Reanimated colors |

---

## Fix Strategy

1. **`interpolateColor()`** for animated background colors (Reanimated-native, no string alpha math).
2. **`clampOpacity()`** worklet for all animated opacity values — clamps to `[0, 1]` and snaps near-zero floats to `0` to avoid sub-normal artifacts.
3. **`safeRgba()`** utility available for any future manual rgba worklets.

---

## Files Modified

| File | Change |
|------|--------|
| `mobile/src/utils/reanimatedColors.ts` | **NEW** — `clampOpacity`, `safeRgba`, highlight color constants |
| `mobile/src/components/chat/MessageBubble.tsx` | Replaced manual `rgba()` template with `interpolateColor(highlight.value, [0,1], [from, to])` |
| `mobile/src/components/chat/SwipeableMessageRow.tsx` | Swipe reply hint uses `clampOpacity()` for opacity + scale progress |
| `mobile/src/components/NotificationPanel.tsx` | Overlay opacity wrapped with `clampOpacity()` after `interpolate` |

---

## Component Audit (Requested Areas)

| Area | Reanimated usage | rgba / color risk | Action |
|------|------------------|-------------------|--------|
| Message Bubble | `withTiming` highlight | **Was invalid** | Fixed with `interpolateColor` |
| Reply Bubble | None (static styles) | None | No change |
| Swipe Reply | `withSpring` + opacity | Low | Hardened with `clampOpacity` |
| Pinned Message | `withSpring` translateX only | None | No change |
| Selected Message | Static border/background | None | No change |
| Reaction Modal | RN `Modal` fade | None | No change |
| Theme Animation | Settings store (no Reanimated) | None | No change |
| Navigation Animation | Expo Router built-in | None | No change |

---

## Before / After

**Before (broken):**
```typescript
backgroundColor: `rgba(37, 99, 235, ${highlight.value * 0.22})`,
// → rgba(37, 99, 235, 8.15852752200641e-7)  ❌
```

**After (fixed):**
```typescript
backgroundColor: interpolateColor(
  highlight.value,
  [0, 1],
  ['rgba(37, 99, 235, 0)', 'rgba(37, 99, 235, 0.22)']
),
// → valid color at every frame  ✅
```

---

## Testing Checklist

- [ ] Jump to pinned message — blue highlight fades smoothly, no Reanimated warnings
- [ ] Swipe right to reply — hint icon fades/scales in without flicker
- [ ] Open notification panel — overlay dimming animates correctly
- [ ] Scroll chat with many messages — no console rgba warnings
- [ ] Dark and light theme — highlight visible on received messages

---

## Prevention

For any new Reanimated color animation:

- Prefer **`interpolateColor(sharedValue, inputRange, outputRange)`**
- For opacity-only effects, use the **`opacity`** style property with **`clampOpacity()`**
- Never build `rgba(..., ${sharedValue})` template strings on the UI thread
