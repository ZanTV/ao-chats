import { prisma } from '../../config/database';
import { cacheGet, cacheSet, cacheDel, cacheInvalidatePattern, CacheKeys, CacheTTL } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { config } from '../../config';
import { sanitizeInput } from '../../middleware/validation';
import { MessageStatus } from '@prisma/client';

async function getRecipientStatus(conversationId: string, senderId: string) {
  const other = await prisma.participant.findFirst({
    where: { conversationId, userId: { not: senderId } },
    include: { user: { select: { id: true, status: true } } },
  });
  return other?.user ?? null;
}

export class MessageService {
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT',
    replyToId?: string,
    options?: { isForwarded?: boolean; forwardedFromId?: string }
  ) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    if (replyToId) {
      const replyMsg = await prisma.message.findFirst({
        where: { id: replyToId, conversationId },
      });
      if (!replyMsg) throw new AppError(400, 'Reply message not found');
    }

    const recipient = await getRecipientStatus(conversationId, senderId);
    const initialStatus: MessageStatus =
      recipient && recipient.status !== 'ONLINE' ? 'WAITING' : 'SENT';

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId,
          content: sanitizeInput(content),
          type,
          replyToId,
          status: initialStatus,
          waitingAt: initialStatus === 'WAITING' ? new Date() : null,
          isForwarded: options?.isForwarded ?? false,
          forwardedFromId: options?.forwardedFromId,
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatarId: true },
          },
          replyTo: {
            select: { id: true, content: true, senderId: true },
          },
          reactions: {
            include: { user: { select: { id: true, firstName: true } } },
          },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return msg;
    });

    await cacheDel(CacheKeys.messages(conversationId));
    await cacheInvalidatePattern(`${CacheKeys.messages(conversationId)}:*`);
    return message;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50
  ) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const cacheKey = `${CacheKeys.messages(conversationId)}:${userId}`;
    if (!cursor) {
      const cached = await cacheGet<unknown[]>(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletedForAll: false,
        NOT: { deletedFor: { has: userId } },
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarId: true },
        },
        replyTo: {
          select: {
            id: true, content: true, senderId: true,
            sender: { select: { firstName: true } },
          },
        },
        reactions: {
          include: { user: { select: { id: true, firstName: true } } },
        },
        pins: true,
        stars: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const result = messages.reverse();

    if (!cursor && result.length > 0) {
      await cacheSet(cacheKey, result, CacheTTL.messages);
    }

    return result;
  }

  async searchMessages(conversationId: string, userId: string, query: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    return prisma.message.findMany({
      where: {
        conversationId,
        content: { contains: query, mode: 'insensitive' },
        deletedForAll: false,
        NOT: { deletedFor: { has: userId } },
      },
      include: {
        sender: { select: { id: true, firstName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async reactToMessage(messageId: string, userId: string, emoji: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found');

    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: { conversationId: message.conversationId, userId },
      },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
      return { action: 'removed', emoji };
    }

    const reaction = await prisma.messageReaction.create({
      data: { messageId, userId, emoji },
      include: { user: { select: { id: true, firstName: true } } },
    });

    await prisma.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    });

    await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
    return { action: 'added', reaction };
  }

  async deleteMessage(messageId: string, userId: string, forEveryone: boolean) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found');

    if (forEveryone) {
      if (message.senderId !== userId) throw new AppError(403, 'Can only delete own messages for everyone');
      const ageMs = Date.now() - message.createdAt.getTime();
      if (ageMs > 3600000) throw new AppError(400, 'Can only delete for everyone within 1 hour');

      await prisma.message.update({
        where: { id: messageId },
        data: { isDeleted: true, deletedForAll: true, content: 'This message was deleted' },
      });
    } else {
      await prisma.message.update({
        where: { id: messageId },
        data: { deletedFor: { push: userId } },
      });
    }

    await prisma.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    });

    await cacheDel(CacheKeys.messages(message.conversationId));
    await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
    return { message: 'Message deleted' };
  }

  async forwardMessage(messageId: string, userId: string, targetConversationId: string) {
    const original = await prisma.message.findUnique({ where: { id: messageId } });
    if (!original) throw new AppError(404, 'Message not found');

    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: { conversationId: targetConversationId, userId },
      },
    });
    if (!participant) throw new AppError(403, 'Not a participant in target conversation');

    return this.sendMessage(
      targetConversationId,
      userId,
      original.content,
      original.type as 'TEXT',
      undefined,
      { isForwarded: true, forwardedFromId: messageId }
    );
  }

  async starMessage(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found');

    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: { conversationId: message.conversationId, userId },
      },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const star = await prisma.starredMessage.upsert({
      where: { userId_messageId: { userId, messageId } },
      create: { userId, messageId, conversationId: message.conversationId },
      update: {},
      include: {
        message: {
          include: { sender: { select: { id: true, firstName: true, avatarId: true } } },
        },
      },
    });

    await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
    return star;
  }

  async unstarMessage(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found');

    await prisma.starredMessage.deleteMany({ where: { userId, messageId } });
    await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
    return { message: 'Unstarred' };
  }

  async getStarredMessages(userId: string) {
    return prisma.starredMessage.findMany({
      where: { userId },
      include: {
        message: {
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, avatarId: true } },
            conversation: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async promoteWaitingToSent(conversationId: string, recipientId: string) {
    const updated = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: recipientId },
        status: 'WAITING',
      },
      data: { status: 'SENT', waitingAt: null },
    });
    return updated.count;
  }

  async pinMessage(messageId: string, userId: string, conversationId: string) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!message) throw new AppError(404, 'Message not found');

    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const pinCount = await prisma.messagePin.count({ where: { conversationId } });
    if (pinCount >= config.maxPinnedMessages) {
      throw new AppError(400, `Maximum ${config.maxPinnedMessages} pinned messages allowed`);
    }

    const existing = await prisma.messagePin.findUnique({
      where: { messageId_conversationId: { messageId, conversationId } },
    });
    if (existing) throw new AppError(409, 'Message already pinned');

    const pin = await prisma.messagePin.create({
      data: { messageId, conversationId, pinnedById: userId },
      include: {
        message: {
          include: { sender: { select: { id: true, firstName: true } } },
        },
      },
    });

    return pin;
  }

  async unpinMessage(messageId: string, conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    await prisma.messagePin.deleteMany({ where: { messageId, conversationId } });
    return { message: 'Message unpinned' };
  }

  async getPinnedMessages(conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    return prisma.messagePin.findMany({
      where: { conversationId },
      include: {
        message: {
          include: {
            sender: { select: { id: true, firstName: true, avatarId: true } },
          },
        },
        pinnedBy: { select: { id: true, firstName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markDelivered(messageId: string) {
    const now = new Date();
    await prisma.message.update({
      where: { id: messageId },
      data: { deliveredAt: now, status: 'DELIVERED', waitingAt: null },
    });
    return now;
  }

  async markMessagesRead(conversationId: string, readerId: string) {
    const now = new Date();
    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: readerId },
        readAt: null,
        deletedForAll: false,
      },
      data: { readAt: now, status: 'READ' },
    });
    await cacheInvalidatePattern(`${CacheKeys.messages(conversationId)}:*`);
    return { readAt: now, count: result.count };
  }
}

export const messageService = new MessageService();
