# AO Chats v2.0 — Phase 1 MVP

A premium, real-time university chatting application built with React Native (Expo) and Node.js.

## Architecture

```
ao-chats-v2/
├── backend/          # Node.js + Express + Prisma + Socket.IO
├── mobile/           # React Native Expo app
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Expo CLI (`npm install -g expo-cli`)

## Quick Start

### One command (recommended)

From the project root:

```bash
npm install
npm run dev
```

This will:
1. Create `backend/.env.development` and `mobile/.env.development` from examples if missing
2. Start Docker PostgreSQL + Redis (when Docker is available)
3. Start the API at `http://localhost:3001`
4. Start the web app at `http://localhost:8081` and open it in your browser

### Manual setup

#### 1. Start Database & Redis

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

API runs at `http://localhost:3001` (development only)

Production: `https://api.aochats.chat` — see [PRODUCTION_DEPLOYMENT_REPORT.md](./PRODUCTION_DEPLOYMENT_REPORT.md)

### 3. Mobile Setup

```bash
cd mobile
npm install
npx expo start
```

## Features (Phase 1 MVP)

- **Authentication** — Step-by-step signup wizard, login, forgot password, email verification, JWT sessions
- **Profile** — Editable profile with built-in avatars
- **Friends** — Search, request, accept/reject, block/unblock
- **Personal Chat** — Real-time 1:1 messaging with typing, read receipts, reactions, replies, pins, delete
- **Settings** — Theme (light/dark), language (EN/SW), font size, blocked users
- **Notifications** — Friend requests, new messages
- **Offline Cache** — Messages, friends, profile cached locally

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo, Zustand |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Real-time | Socket.IO |
| Cache | Redis |
| Auth | JWT + bcrypt |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| POST | /api/auth/verify-email | Verify email |
| GET | /api/users/me | Get profile |
| GET | /api/friends | List friends |
| POST | /api/friends/request/:id | Send friend request |
| GET | /api/conversations | List conversations |
| POST | /api/messages/:id | Send message |
| GET | /api/notifications | Get notifications |

## Environment Variables

See `backend/.env.example` for all configuration options.

## License

Proprietary — AO Chats © 2026
