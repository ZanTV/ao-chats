# AO Chats v2.0 — Profile Enhancement Report

## Components Updated

### Mobile (`mobile/`)

| File | Changes |
|------|---------|
| `app/(tabs)/profile.tsx` | Premium layout with sections, verified badge, online status, private fields with lock icons |
| `app/profile/edit.tsx` | Full edit form: username, university, mobile, dirty-state save, validation |
| `src/components/ProfileSection.tsx` | **New** — Reusable section cards and field rows with privacy/verified badges |
| `src/utils/profile.ts` | **New** — Date formatting, last seen, mobile helpers |
| `src/utils/validation.ts` | Added `validateMobileNumber()` E.164 validation |
| `src/stores/authStore.ts` | Extended `User` type with `mobileNumber`, `emailVerified`, `createdAt`, `lastSeen` |
| `src/localization/index.ts` | Profile strings EN + SW |
| `src/services/api.ts` | Uses owner profile endpoint (unchanged path `/users/me`) |

### Backend (`backend/`)

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `mobileNumber` field (nullable, unique) |
| `src/modules/users/user.validation.ts` | **New** — Profile update schema + E.164 validation |
| `src/modules/users/user.service.ts` | Owner vs public profile selects, mobile/username duplicate checks |
| `src/modules/users/user.routes.ts` | `GET /check-username/:username`, public profile on `GET /:id` |
| `src/modules/auth/auth.validation.ts` | Removed duplicate `updateProfileSchema` (moved to users module) |

---

## Database Changes

```sql
ALTER TABLE users ADD COLUMN mobile_number TEXT UNIQUE;
CREATE UNIQUE INDEX ON users(mobile_number);
```

| Field | Type | Rules |
|-------|------|-------|
| `mobile_number` | `TEXT NULL` | Unique, E.164 format, owner-only access |

**Run migration:**
```bash
cd backend
npx prisma db push --accept-data-loss
npx prisma generate
```

---

## Prisma Changes

```prisma
mobileNumber  String?  @unique @map("mobile_number")
```

Added to `User` model in `backend/prisma/schema.prisma`.

---

## API Changes

### Owner Profile — `GET /api/users/me`
Returns **all fields** including private data:
- email, emailVerified, mobileNumber, createdAt, lastSeen, status

### Update Profile — `PATCH /api/users/me`
New/updated fields:
- `username` — duplicate check
- `mobileNumber` — E.164 validation, duplicate check, nullable (send `""` to remove)

### Public Profile — `GET /api/users/:id`
Returns **only public fields**:
- avatarId, firstName, lastName, username, bio, university, course, status, statusMessage, lastSeen

**Never returns:** email, mobileNumber, createdAt, emailVerified

### Username Check — `GET /api/users/check-username/:username`
Excludes current user when checking availability during edit.

---

## Security Improvements

- E.164 phone validation on server and client
- Duplicate username prevention on update
- Duplicate mobile number prevention (unique constraint)
- Public endpoints strip private fields at query level (Prisma `select`)
- Owner-only mobile number — never in search, never in public profile
- Input trimming and sanitization on all profile fields
- Cache invalidated on profile update

---

## Privacy Rules

| Field | Owner | Friends/Public |
|-------|-------|----------------|
| Avatar | ✅ | ✅ |
| Full Name | ✅ | ✅ |
| Username | ✅ | ✅ |
| Bio | ✅ | ✅ |
| University | ✅ | ✅ |
| Course | ✅ | ✅ |
| Status / Last Seen | ✅ | ✅ |
| Email | ✅ 🔒 | ❌ |
| Mobile Number | ✅ 🔒 | ❌ |
| Member Since | ✅ | ❌ |

---

## Testing Checklist

- [ ] Run `npx prisma db push` on Neon database
- [ ] View Profile — all sections display correctly
- [ ] Edit Profile — change avatar, name, username, bio
- [ ] Update University and Course
- [ ] Add mobile number `+254712345678`
- [ ] Remove mobile number (clear field, save)
- [ ] Invalid mobile `0712345678` — shows validation error
- [ ] Duplicate username — shows error
- [ ] Save disabled until changes made
- [ ] Success message after save
- [ ] `GET /users/:id` — confirm no email/mobile in response
- [ ] `GET /users/me` — confirm email/mobile present
- [ ] Cache refresh after update
- [ ] Verified badge shows when emailVerified=true
- [ ] Online status / last seen displays correctly

---

## Phase 2 Ready

- Mobile number field ready for SMS verification / 2FA
- Verification badge UI ready for future badges
- Last seen ready for real-time socket updates
- Privacy settings per field (university/course visibility toggle)
