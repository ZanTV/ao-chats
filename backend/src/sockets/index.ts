import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { parseCorsOrigins } from '../config/cors';
import { prisma } from '../config/database';
import { getRedis, CacheKeys } from '../config/redis';
import { messageService } from '../modules/messages/message.service';
import { conversationService } from '../modules/conversations/conversation.service';
import { emitConversationUpdated } from './conversation.events';
import { createAndDispatchMessage } from './message.dispatch';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface JwtPayload {
  userId: string;
  email: string;
}

const typingUsers = new Map<string, Set<string>>();

export function setupSocketIO(httpServer: HttpServer): Server {
  const corsOrigins = parseCorsOrigins();

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, emailVerified: true },
      });

      if (!user || !user.emailVerified) return next(new Error('Unauthorized'));
      socket.userId = user.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`User connected: ${userId}`);

    socket.join(`user:${userId}`);

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ONLINE', lastSeen: new Date() },
    });

    try {
      const redis = getRedis();
      if (redis) await redis.sadd(CacheKeys.onlineUsers, userId);
    } catch {
      // Redis optional at connect time
    }

    socket.broadcast.emit('user:online', { userId });

    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('message:send', async (data: {
      conversationId: string;
      content: string;
      type?: 'TEXT';
      replyToId?: string;
      tempId?: string;
    }) => {
      try {
        await createAndDispatchMessage(
          io,
          data.conversationId,
          userId,
          data.content,
          data.type || 'TEXT',
          data.replyToId,
          data.tempId
        );
      } catch (err) {
        socket.emit('message:error', {
          tempId: data.tempId,
          error: err instanceof Error ? err.message : 'Failed to send message',
        });
      }
    });

    socket.on('message:read', async (data: { conversationId: string; messageIds?: string[] }) => {
      await conversationService.markAsRead(data.conversationId, userId);

      io.to(`conversation:${data.conversationId}`).emit('message:read', {
        conversationId: data.conversationId,
        userId,
        readAt: new Date(),
      });

      await emitConversationUpdated(io, data.conversationId);
    });

    socket.on('message:delivered', async (data: { messageId: string; conversationId: string }) => {
      await messageService.markDelivered(data.messageId);
      io.to(`conversation:${data.conversationId}`).emit('message:delivered', {
        messageId: data.messageId,
        deliveredAt: new Date(),
      });
    });

    socket.on('typing:start', (data: { conversationId: string }) => {
      if (!typingUsers.has(data.conversationId)) {
        typingUsers.set(data.conversationId, new Set());
      }
      typingUsers.get(data.conversationId)!.add(userId);

      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        conversationId: data.conversationId,
        userId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      typingUsers.get(data.conversationId)?.delete(userId);
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        conversationId: data.conversationId,
        userId,
      });
    });

    socket.on('message:react', async (data: { messageId: string; emoji: string; conversationId: string }) => {
      try {
        const result = await messageService.reactToMessage(data.messageId, userId, data.emoji);
        io.to(`conversation:${data.conversationId}`).emit('message:react', {
          messageId: data.messageId,
          ...result,
          userId,
        });

        if (result.action === 'added') {
          const message = await prisma.message.findUnique({
            where: { id: data.messageId },
            include: { sender: { select: { firstName: true } } },
          });
          if (message) {
            await emitConversationUpdated(io, data.conversationId, message, {
              reactionEmoji: data.emoji,
              reactorId: userId,
            });
          }
        }
      } catch (err) {
        socket.emit('message:error', {
          error: err instanceof Error ? err.message : 'Failed to react',
        });
      }
    });

    socket.on('message:delete', async (data: {
      messageId: string;
      conversationId: string;
      forEveryone: boolean;
    }) => {
      try {
        await messageService.deleteMessage(data.messageId, userId, data.forEveryone);
        io.to(`conversation:${data.conversationId}`).emit('message:delete', {
          messageId: data.messageId,
          forEveryone: data.forEveryone,
          userId,
        });

        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
          include: { sender: { select: { firstName: true } } },
        });
        if (message) {
          await emitConversationUpdated(io, data.conversationId, {
            ...message,
            content: 'This message was deleted',
            isDeleted: true,
            deletedForAll: data.forEveryone,
          });
        }
      } catch (err) {
        socket.emit('message:error', {
          error: err instanceof Error ? err.message : 'Failed to delete',
        });
      }
    });

    socket.on('message:pin', async (data: { messageId: string; conversationId: string }) => {
      try {
        const pin = await messageService.pinMessage(data.messageId, userId, data.conversationId);
        io.to(`conversation:${data.conversationId}`).emit('message:pin', pin);
      } catch (err) {
        socket.emit('message:error', {
          error: err instanceof Error ? err.message : 'Failed to pin',
        });
      }
    });

    socket.on('message:unpin', async (data: { messageId: string; conversationId: string }) => {
      await messageService.unpinMessage(data.messageId, data.conversationId, userId);
      io.to(`conversation:${data.conversationId}`).emit('message:unpin', {
        messageId: data.messageId,
      });
    });

    socket.on('friend:request', async (data: { receiverId: string; request: unknown }) => {
      io.to(`user:${data.receiverId}`).emit('friend:request', data.request);
    });

    socket.on('friend:accepted', async (data: { senderId: string; friend: unknown }) => {
      io.to(`user:${data.senderId}`).emit('friend:accepted', data.friend);
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);

      await prisma.user.update({
        where: { id: userId },
        data: { status: 'OFFLINE', lastSeen: new Date() },
      });

      try {
        const redis = getRedis();
        if (redis) await redis.srem(CacheKeys.onlineUsers, userId);
      } catch {
        // ignore
      }

      typingUsers.forEach((users, conversationId) => {
        if (users.has(userId)) {
          users.delete(userId);
          io.to(`conversation:${conversationId}`).emit('typing:stop', {
            conversationId,
            userId,
          });
        }
      });

      socket.broadcast.emit('user:offline', { userId, lastSeen: new Date() });
    });
  });

  return io;
}

export function getIO(): Server | null {
  return (global as unknown as { io: Server }).io || null;
}

export function setIO(io: Server): void {
  (global as unknown as { io: Server }).io = io;
}
