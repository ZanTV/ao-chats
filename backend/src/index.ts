import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { spawn } from 'child_process';
import path from 'path';
import { createServer } from 'http';
import { config } from './config';
import { isHostedPlatform } from './config/platform';
import { parseCorsOrigins } from './config/cors';
import { connectRedis, isRedisAvailable } from './config/redis';
import { prisma } from './config/database';
import { verifyEmailTransport } from './utils/email.utils';
import { ensureAoManagerAccount } from './services/ao-manager.service';
import { ensureProductionSchema, isProductionSchemaReady } from './database/schemaEnsure';
import { errorHandler } from './middleware/errorHandler';
import { authLimiter, apiLimiter } from './middleware/rateLimit';
import { setupSocketIO, setIO } from './sockets';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import friendRoutes from './modules/friends/friend.routes';
import conversationRoutes from './modules/conversations/conversation.routes';
import messageRoutes from './modules/messages/message.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import uploadRoutes from './modules/uploads/upload.routes';
import mediaRoutes from './modules/media/media.routes';

const app = express();
const httpServer = createServer(app);
const corsOrigins = parseCorsOrigins();

// Instant liveness probe — no DB/Redis. Render must use this path to avoid 502 during cold start.
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
});

if (config.isProduction) {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: config.isProduction,
    crossOriginEmbedderPolicy: false,
    hsts: config.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Render/Railway healthcheck requires HTTP 200 while the process is alive.
app.get('/health', async (_req, res) => {
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('database check timed out')), 5000)
      ),
    ]);
    dbOk = true;
  } catch (err) {
    dbOk = false;
    dbError = err instanceof Error ? err.message : 'unknown';
  }

  const redisOk = isRedisAvailable();
  const schemaReady = dbOk ? await isProductionSchemaReady() : false;
  const payload = {
    success: dbOk && schemaReady,
    status: dbOk && schemaReady ? 'ok' : 'degraded',
    message: 'AO Chats API',
    version: '2.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'disconnected',
    schema: schemaReady ? 'ready' : 'pending',
    redis: redisOk ? 'connected' : 'unavailable',
    socketIo: 'connected',
    services: {
      database: dbOk ? 'connected' : 'disconnected',
      schema: schemaReady ? 'ready' : 'pending',
      redis: redisOk ? 'connected' : 'unavailable',
    },
    ...(dbError && !dbOk ? { databaseError: dbError } : {}),
  };

  res.status(200).json(payload);
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/media', mediaRoutes);

app.use(errorHandler);

const io = setupSocketIO(httpServer);
setIO(io);

async function bootstrap() {
  const connected = await connectRedis();
  if (connected) {
    console.log('Redis connected');
  } else if (config.isProduction) {
    console.warn('Redis not available in production — cache disabled');
  } else {
    console.warn('Redis not available — running without cache');
  }

  await verifyEmailTransport();

  try {
    await ensureAoManagerAccount();
  } catch (err) {
    console.warn('AO Manager setup skipped:', err instanceof Error ? err.message : err);
  }
}

function scheduleBackgroundMigrations() {
  if (process.env.SKIP_MIGRATE_ON_START === 'true') return;
  if (!config.isProduction || !isHostedPlatform()) return;

  setTimeout(() => {
    console.log('→ Running database migrations in background…');
    const script = path.join(process.cwd(), 'scripts', 'migrate-deploy.mjs');
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) console.log('✓ Background migrations finished');
      else console.error(`✗ Background migrations failed (exit ${code})`);
    });
  }, 3000);
}

async function start() {
  if (config.isProduction && config.databaseUrl) {
    try {
      await ensureProductionSchema();
      console.log('✓ Production schema patches applied');
    } catch (err) {
      console.error(
        'Startup schema patch failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`AO Chats API v2.0 running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    if (isHostedPlatform()) {
      console.log(`Platform: ${process.env.RENDER_SERVICE_NAME || 'Render'}`);
    }
    if (config.isProduction) {
      console.log(`Client URL: ${config.clientUrl}`);
      if (!config.databaseUrl) {
        console.error('[AO Chats] DATABASE_URL is missing — API routes will fail until set in Render Environment');
      }
    }
    scheduleBackgroundMigrations();
  });

  httpServer.on('error', (err) => {
    console.error('[AO Chats] HTTP server error:', err);
    process.exit(1);
  });

  void bootstrap().catch((err) => {
    console.error('Background bootstrap failed:', err instanceof Error ? err.message : err);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[AO Chats] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[AO Chats] Unhandled rejection:', reason);
});

void start().catch((err) => {
  console.error('[AO Chats] Failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});

export { app, httpServer, io };
