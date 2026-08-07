# Railway Deployment — AO Chats Backend

Set **Root Directory** = `backend` in Railway service settings.

## Required variables (Railway Dashboard → Variables)

Copy from your local `backend/.env.production`:

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled PostgreSQL URL |
| `DATABASE_URL_UNPOOLED` | Neon direct URL (optional — falls back to DATABASE_URL) |
| `REDIS_URL` | `rediss://default:...@....upstash.io:6379` |
| `JWT_SECRET` | Strong random secret |
| `JWT_REFRESH_SECRET` | Strong random secret |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail |
| `SMTP_PASS` | Gmail App Password |
| `EMAIL_FROM` | `AO Chats <noreply@aochats.com>` |
| `CLIENT_URL` | `https://www.aochats.chat` |
| `CORS_ORIGIN` | `https://www.aochats.chat` |
| `SOCKET_CORS_ORIGIN` | `https://www.aochats.chat` |

Health: `https://api.aochats.chat/health`
