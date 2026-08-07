# AO Chats v2.0 — Multi-Level Cache Architecture Report

**Date:** August 6, 2026  
**Status:** Implemented  
**Stack:** PostgreSQL · Redis · MMKV · SQLite · AsyncStorage · Socket.IO

---

## 1. Cache Layers

| Layer | Technology | Purpose | TTL / Persistence |
|-------|------------|---------|-------------------|
| **L0 — Source of truth** | PostgreSQL (Prisma) | All authoritative data | Permanent |
| **L1 — Server cache** | Redis (ioredis) | Hot reads, versioned envelopes | 10–60 min per domain |
| **L2 — Fast local cache** | MMKV (`react-native-mmkv`) | Profiles, lists, metadata | Until logout / version bump |
| **L3 — Offline messages** | SQLite (`expo-sqlite`) | Conversation history | Until logout |
| **L4 — Preferences** | AsyncStorage (`pref:*` keys) | Theme, language, font size | Permanent |
| **L5 — Real-time sync** | Socket.IO | Instant updates, optimistic UI | Ephemeral |

### Cached Domains

| Domain | L1 Redis | L2 MMKV | L3 SQLite |
|--------|----------|---------|-----------|
| User profile | ✅ | ✅ | — |
| Friend list | ✅ | ✅ | — |
| Conversations | ✅ | ✅ | — |
| Messages (latest page) | ✅ | — | ✅ (full history) |
| Pinned messages | ✅ | — | — |
| Starred messages | ✅ | ✅ | — |
| Notification summary | ✅ | ✅ | — |
| Notification count | ✅ | ✅ | — |
| Universities | ✅ | ✅ | — |
| Avatars | ✅ | ✅ | — |
| Search history | — | ✅ | — |
| Settings / theme / language | — | — | — (AsyncStorage) |

---

## 2. Database Flow (PostgreSQL)

```
Client Request
      ↓
API Route (Express)
      ↓
Service Layer (Prisma)
      ↓
PostgreSQL ← single source of truth
      ↓
Response + cacheVersion timestamp
```

**Write path:** All mutations (send message, pin, friend request, etc.) go directly to PostgreSQL. Redis keys are invalidated on write; Socket.IO broadcasts changes to connected clients.

**Key files:**
- `backend/prisma/schema.prisma`
- `backend/src/modules/*/*.service.ts`

---

## 3. Redis Flow

```
GET /resource
      ↓
cacheGetVersioned(key)
      ↓
Hit? → return { data, version }
      ↓
Miss? → PostgreSQL query
      ↓
cacheSetVersioned(key, data, TTL)
      ↓
return { data, cacheVersion }
```

### Redis Key Schema

| Key Pattern | Content |
|-------------|---------|
| `user:{id}:owner` | Owner profile envelope |
| `friends:{userId}` | Friend list envelope |
| `conversations:{userId}` | Conversation list envelope |
| `messages:{convId}:{userId}:latest` | Latest 30 messages envelope |
| `pins:{convId}:{userId}` | Pinned messages envelope |
| `stars:{userId}` | Starred messages envelope |
| `notifications:{userId}` | Notification summary envelope |
| `notifications:count:{userId}` | Unread count envelope |
| `static:universities` | University list |
| `static:avatars` | Avatar categories |

### Version Envelope

```typescript
interface CacheEnvelope<T> {
  v: number;        // Date.now() at write time
  updatedAt: string;
  data: T;
}
```

### Invalidation

- **Single key:** `cacheDel(key)` — also removes `{key}:version`
- **Pattern:** `cacheInvalidatePattern` — uses **SCAN** (not KEYS) for production safety
- **Triggers:** New message, delete, pin/unpin, star/unstar, friend changes, notification read

**Key file:** `backend/src/config/redis.ts`

---

## 4. Local Cache Flow (Mobile)

```
Open Screen
      ↓
Read MMKV / SQLite          ← synchronous, non-blocking
      ↓
Render Immediately
      ↓
Fetch API (Redis-backed)
      ↓
Compare cacheVersion
      ↓
If changed → update MMKV/SQLite → update UI
      ↓
If offline → keep local data
```

### MMKV (`src/cache/mmkvStore.ts`)

- Used for structured envelopes: `{ version, updatedAt, data }`
- Fallback to in-memory Map on web / if native module unavailable
- Keys: `cache:{domain}` or `cache:{domain}:{id}`

### SQLite (`src/cache/messageDb.ts`)

- Database: `ao_chats_messages.db`
- Table: `messages(id, conversation_id, payload, created_at)`
- WAL mode enabled for concurrent reads
- `INSERT OR REPLACE` for upserts — messages never disappear on reopen

### AsyncStorage (preferences only)

- Keys prefixed `pref:` — theme, fontSize, language
- Tokens remain in SecureStore (unchanged)

### CacheManager (`src/cache/CacheManager.ts`)

Central orchestrator with `loadWithRefresh()`:

```typescript
await cacheManager.loadWithRefresh(
  CacheDomain.CONVERSATIONS,
  async () => {
    const res = await api.getConversations();
    return { data: res.conversations, cacheVersion: res.cacheVersion };
  },
  (data) => setConversations(data)  // called immediately with cache, then with fresh data
);
```

---

## 5. Message Loading Flow

```
Open Chat Screen
      ↓
sqliteGetLatestMessages(conversationId)   ← instant render
      ↓
setLoading(false) if local data exists
      ↓
api.getMessages(id, undefined, 30)        ← newest 30 from server
      ↓
Merge + dedupe + sort by createdAt
      ↓
sqliteUpsertMessages(conversationId, merged)
      ↓
User scrolls to top (offset < 60px)
      ↓
api.getMessages(id, nextCursor, 30)       ← older page
      ↓
Prepend to list + persist to SQLite
```

### Pagination API

```
GET /messages/:conversationId?cursor={isoDate}&limit=30

Response:
{
  "messages": [...],
  "nextCursor": "2026-08-01T12:00:00.000Z" | null,
  "hasMore": true,
  "cacheVersion": 1722950400000
}
```

### Guarantees

- Messages **never disappear** after reopening — SQLite is read first
- Socket events append via `upsertMessage` + SQLite persist
- Optimistic sends use temp IDs, reconciled on server ack

**Key files:**
- `mobile/app/chat/[id].tsx`
- `mobile/src/cache/messageDb.ts`
- `backend/src/modules/messages/message.service.ts`

---

## 6. Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| **Non-blocking UI** | Local cache rendered before any network call |
| **Stale-while-revalidate** | `loadWithRefresh()` pattern across screens |
| **Optimistic updates** | Temp message IDs, local reaction/star state |
| **Lazy loading** | Message pagination (30 per page) |
| **FlatList tuning** | `initialNumToRender=15`, `windowSize=7`, `removeClippedSubviews` on Android |
| **Memoization** | `useMemo` for listData, actionLabels; `useCallback` for handlers |
| **Socket dedup** | `dedupeSocketHandler()` — 300ms window per event key |
| **API timeouts** | 15s fetch timeout (existing) |
| **Redis SCAN** | Non-blocking pattern invalidation |
| **SQLite WAL** | Concurrent read during writes |

### Avatar / Image Caching

Avatars are emoji-based (`Avatar.tsx`) — no remote image fetches. No additional image cache layer required.

---

## 7. Offline Strategy

| Scenario | Behavior |
|----------|----------|
| **Open app offline** | MMKV profile + SQLite messages + MMKV conversation list shown |
| **Open chat offline** | Full SQLite history available; send queued/fails gracefully |
| **Mid-session disconnect** | Socket reconnects; cached data remains visible |
| **Session expired** | SecureStore cleared; MMKV/SQLite cleared on logout |
| **Server unreachable** | Cached data preserved; error UI only if zero local data |

### Logout Cleanup

```typescript
await clearTokens();      // SecureStore
await clearCache();       // MMKV prefix `cache:` + SQLite messages
```

---

## 8. Socket.IO Synchronization

Every PostgreSQL write emits Socket.IO events. Mobile handlers update local state + SQLite:

| Event | Action |
|-------|--------|
| `message:new` | upsertMessage + SQLite (deduped) |
| `message:react` | Update reactions in-place |
| `message:pin/unpin` | Reload pin metadata |
| `conversation:updated` | Patch conversation list |
| `friend:request/accepted` | Refresh friends cache |

---

## 9. File Map

### Backend (new/updated)

```
backend/src/config/redis.ts                          — Versioned cache, SCAN invalidation
backend/src/modules/conversations/conversation.service.ts
backend/src/modules/friends/friend.service.ts
backend/src/modules/notifications/notification.service.ts
backend/src/modules/messages/message.service.ts      — Pagination, pin/star cache
backend/src/modules/users/user.service.ts
backend/src/modules/auth/auth.routes.ts              — Static list cache
```

### Mobile (new)

```
mobile/src/cache/types.ts
mobile/src/cache/mmkvStore.ts
mobile/src/cache/messageDb.ts
mobile/src/cache/CacheManager.ts
mobile/src/cache/index.ts
mobile/src/utils/socketDedup.ts
```

### Mobile (updated)

```
mobile/src/services/storage.ts       — MMKV profile, AsyncStorage prefs only
mobile/src/services/api.ts           — Pagination params, cacheVersion types
mobile/src/services/signupOptions.ts — Cached universities/avatars
mobile/src/stores/authStore.ts       — Logout cache clear
mobile/src/stores/notificationStore.ts
mobile/app/(tabs)/index.tsx          — Conversation cache
mobile/app/(tabs)/friends.tsx        — Friends cache + search history
mobile/app/chat/[id].tsx             — SQLite + pagination
mobile/app/starred.tsx               — Starred cache
mobile/package.json                  — expo-sqlite, react-native-mmkv
```

---

## 10. Testing Checklist

### Cache Layers

- [ ] Redis connected in production (`REDIS_URL` set on Railway)
- [ ] Redis miss falls through to PostgreSQL without error
- [ ] Redis unavailable — app still works (degraded, no server cache)

### Local-First Loading

- [ ] Home screen shows cached conversations instantly on open
- [ ] Chat screen shows SQLite messages before network completes
- [ ] Profile loads from MMKV on cold start with slow network

### Version Sync

- [ ] Send message on device A → device B conversation list updates
- [ ] `cacheVersion` changes after friend accept → friends list refreshes
- [ ] Star message → starred screen updates on next open

### Messages

- [ ] Open chat → newest 30 messages load
- [ ] Scroll to top → older messages load (loading spinner in header)
- [ ] Close and reopen chat → all previously loaded messages still visible
- [ ] Airplane mode → existing messages visible, send shows error
- [ ] Receive socket message while chat open → appears without refresh

### Pagination Edge Cases

- [ ] Conversation with < 30 messages — no infinite load loop
- [ ] Conversation with 100+ messages — scroll loads all pages
- [ ] Jump to pinned message loads context via `getMessagesAround`

### Offline / Logout

- [ ] Logout clears MMKV cache and SQLite
- [ ] Login as different user — no stale data from previous user
- [ ] Theme/language persist across logout (AsyncStorage prefs)

### Performance

- [ ] Chat scroll stays smooth with 200+ messages
- [ ] No duplicate messages from socket + REST race
- [ ] FlatList doesn't re-render entire list on single reaction

### Backend

- [ ] `GET /conversations` returns `cacheVersion`
- [ ] `GET /messages/:id?limit=30` returns `nextCursor`, `hasMore`
- [ ] Pin/unpin invalidates pin cache
- [ ] Star/unstar invalidates star cache

---

## 11. Deployment Notes

1. **Backend:** Redeploy Railway with updated Redis cache layer
2. **Database:** `npx prisma db push` if schema changes pending
3. **Mobile:** New native build required for MMKV + SQLite (`eas build`)
4. **Environment:** Ensure `REDIS_URL` is configured in production

---

## 12. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE APP                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │ AsyncStorage│  │    MMKV     │  │     SQLite       │  │
│  │ prefs only  │  │ lists/meta  │  │ message history  │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                │                   │              │
│         └────────────────┼───────────────────┘              │
│                          │                                  │
│                   CacheManager                              │
│                          │                                  │
│              ┌───────────┴───────────┐                      │
│              │    REST API + Socket  │                      │
└──────────────┼───────────────────────┼──────────────────────┘
               │                       │
┌──────────────┼───────────────────────┼──────────────────────┐
│              ▼                       ▼         BACKEND       │
│         Express Routes          Socket.IO                    │
│              │                       │                       │
│         Service Layer ◄──────────────┘                       │
│              │                                               │
│    ┌─────────┴─────────┐                                    │
│    ▼                   ▼                                    │
│  Redis              PostgreSQL                               │
│  (cache)            (source of truth)                        │
└─────────────────────────────────────────────────────────────┘
```

---

*Generated for AO Chats v2.0 multi-level cache implementation.*
