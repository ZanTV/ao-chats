import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { config } from './config';
import { parseCorsOrigins } from './config/cors';
import { connectRedis, isRedisAvailable } from './config/redis';
import { prisma } from './config/database';
import { verifyEmailTransport } from './utils/email.utils';
import { ensureAoManagerAccount } from './services/ao-manager.service';
import { errorHandler } from './middleware/errorHandler';
import { authLimiter, apiLimiter } from './middleware/rateLimit';
import { setupSocketIO, setIO } from './sockets';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import friendRoutes from './modules/friends/friend.routes';
import conversationRoutes from './modules/conversations/conversation.routes';
import messageRoutes from './modules/messages/message.routes';
import notificationRoutes from './modules/notifications/notification.routes';

const app = express();
const httpServer = createServer(app);
const corsOrigins = parseCorsOrigins();

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

app.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const payload = {
    status: dbOk ? 'ok' : 'degraded',
    version: '2.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'connected' : 'disconnected',
      redis: isRedisAvailable() ? 'connected' : 'unavailable',
    },
  };

  res.status(dbOk ? 200 : 503).json(payload);
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(errorHandler);

const io = setupSocketIO(httpServer);
setIO(io);

async function start() {
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

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`AO Chats API v2.0 running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    if (config.isProduction) {
      console.log(`Client URL: ${config.clientUrl}`);
    }
  });
}

start();

export { app, httpServer, io };
