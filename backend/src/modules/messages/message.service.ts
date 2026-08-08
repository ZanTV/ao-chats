import { prisma } from '../../config/database';
import {
  cacheGetVersioned,
  cacheSetVersioned,
  cacheDel,
  cacheInvalidatePattern,
  CacheKeys,
  CacheTTL,
} from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { config } from '../../config';
import { sanitizeInput } from '../../middleware/validation';
import { MessageStatus } from '@prisma/client';

const replyToSelect = {
  id: true,
  content: true,
  senderId: true,
  type: true,
  deletedForAll: true,
  isDeleted: true,
  sender: { select: { firstName: true } },
} as const;

const messageListInclude = (userId: string) => ({
  sender: {
    select: { id: true, firstName: true, lastName: true, avatarId: true },
  },
  replyTo: { select: replyToSelect },
  reactions: {
    include: { user: { select: { id: true, firstName: true } } },
  },
  pins: true,
  stars: { where: { userId }, select: { id: true } },
});

async function getRecipientStatus(conversationId: string, senderId: string) {
  const other = await prisma.participant.findFirst({
    where: { conversationId, userId: { not: senderId } },
    include: { user: { select: { id: true, status: true } } },
  });
  return other?.user ?? null;
}

function messageVisibilityWhere(
  conversationId: string,
  userId: string,
  clearedAt?: Date | null,
  extra?: Record<string, unknown>
) {
  return {
    conversationId,
    deletedForAll: false,
    NOT: { deletedFor: { has: userId } },
    ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}),
    ...extra,
  };
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
          replyTo: { select: replyToSelect },
          reactions: {
            include: { user: { select: { id: true, firstName: true } } },
          },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      await tx.participant.updateMany({
        where: { conversationId, hiddenAt: { not: null } },
        data: { hiddenAt: null },
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
    limit = 30
  ) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const cacheKey = `${CacheKeys.messages(conversationId)}:${userId}:latest`;
    if (!cursor) {
      const cached = await cacheGetVersioned<unknown[]>(cacheKey);
      if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
        const oldest = cached.data[0] as { createdAt?: string };
        return {
          messages: cached.data,
          nextCursor: oldest?.createdAt ?? null,
          hasMore: cached.data.length >= limit,
          cacheVersion: cached.version,
        };
      }
    }

    const messages = await prisma.message.findMany({
      where: messageVisibilityWhere(conversationId, userId, participant.clearedAt, {
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      }),
      include: messageListInclude(userId),
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const result = page.reverse();
    const nextCursor = hasMore && result.length > 0 ? result[0].createdAt.toISOString() : null;

    let cacheVersion: number | undefined;
    if (!cursor && result.length > 0) {
      cacheVersion = await cacheSetVersioned(cacheKey, result, CacheTTL.messages);
    }

    return { messages: result, nextCursor, hasMore, cacheVersion };
  }

  /** Load a window of messages centered on a target message (for jump-to). */
  async getMessagesAround(
    conversationId: string,
    userId: string,
    messageId: string,
    limit = 50
  ) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const target = await prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!target) throw new AppError(404, 'Message not found');

    const half = Math.max(10, Math.floor(limit / 2));
    const visibility = messageVisibilityWhere(conversationId, userId, participant.clearedAt);

    const [before, after] = await Promise.all([
      prisma.message.findMany({
        where: { ...visibility, createdAt: { lte: target.createdAt } },
        include: messageListInclude(userId),
        orderBy: { createdAt: 'desc' },
        take: half + 1,
      }),
      prisma.message.findMany({
        where: { ...visibility, createdAt: { gt: target.createdAt } },
        include: messageListInclude(userId),
        orderBy: { createdAt: 'asc' },
        take: half,
      }),
    ]);

    return [...before.reverse(), ...after];
  }

  async searchMessages(conversationId: string, userId: string, query: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    return prisma.message.findMany({
      where: messageVisibilityWhere(conversationId, userId, participant.clearedAt, {
        content: { contains: query, mode: 'insensitive' },
      }),
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

    const existingByUser = await prisma.messageReaction.findFirst({
      where: { messageId, userId },
    });

    if (existingByUser) {
      if (existingByUser.emoji === emoji) {
        await prisma.messageReaction.delete({ where: { id: existingByUser.id } });
        await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
        return {
          action: 'removed' as const,
          emoji,
          previousEmoji: emoji,
          conversationId: message.conversationId,
        };
      }

      const reaction = await prisma.messageReaction.update({
        where: { id: existingByUser.id },
        data: { emoji },
        include: { user: { select: { id: true, firstName: true } } },
      });

      await prisma.conversation.update({
        where: { id: message.conversationId },
        data: { updatedAt: new Date() },
      });

      await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
      return {
        action: 'replaced' as const,
        emoji,
        previousEmoji: existingByUser.emoji,
        reaction,
        conversationId: message.conversationId,
      };
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
    return {
      action: 'added' as const,
      emoji,
      reaction,
      conversationId: message.conversationId,
    };
  }

  async deleteMessage(messageId: string, userId: string, forEveryone: boolean) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found');

    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId,
        },
      },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    if (message.deletedForAll) {
      return { message: 'Message already deleted', conversationId: message.conversationId };
    }

    if (forEveryone) {
      if (message.senderId !== userId) {
        throw new AppError(403, 'Can only delete own messages for everyone');
      }
      const ageMs = Date.now() - message.createdAt.getTime();
      if (ageMs > 3600000) {
        throw new AppError(400, 'Can only delete for everyone within 1 hour');
      }

      await prisma.message.update({
        where: { id: messageId },
        data: { isDeleted: true, deletedForAll: true },
      });

      // Pins pointing at a globally deleted message are stale for everyone
      await prisma.messagePin.deleteMany({
        where: { messageId, conversationId: message.conversationId },
      });
    } else {
      if (message.deletedFor.includes(userId)) {
        return { message: 'Message already deleted', conversationId: message.conversationId };
      }
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
    await cacheDel(CacheKeys.userConversations(userId));
    await cacheDel(CacheKeys.pinnedMessages(message.conversationId));
    await cacheInvalidatePattern(`${CacheKeys.pinnedMessages(message.conversationId)}:*`);
    await cacheDel(CacheKeys.starredMessages(userId));

    return { message: 'Message deleted', conversationId: message.conversationId };
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found');
    if (message.senderId !== userId) throw new AppError(403, 'Can only edit own messages');
    if (message.isEdited) throw new AppError(400, 'Message can only be edited once');
    if (message.deletedForAll || message.isDeleted) throw new AppError(400, 'Cannot edit deleted message');
    if (message.type !== 'TEXT') throw new AppError(400, 'Only text messages can be edited');

    const trimmed = sanitizeInput(content).trim();
    if (!trimmed) throw new AppError(400, 'Message cannot be empty');

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: trimmed,
        isEdited: true,
        editedAt: new Date(),
      },
      include: messageListInclude(userId),
    });

    await cacheDel(CacheKeys.messages(message.conversationId));
    await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
    return updated;
  }

  async getLastVisibleMessage(conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) return null;

    return prisma.message.findFirst({
      where: messageVisibilityWhere(conversationId, userId, participant.clearedAt),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, firstName: true } },
        reactions: { select: { emoji: true }, take: 1 },
      },
    });
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
    await cacheDel(CacheKeys.starredMessages(userId));
    return star;
  }

  async unstarMessage(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found');

    await prisma.starredMessage.deleteMany({ where: { userId, messageId } });
    await cacheInvalidatePattern(`${CacheKeys.messages(message.conversationId)}:*`);
    await cacheDel(CacheKeys.starredMessages(userId));
    return { message: 'Unstarred', conversationId: message.conversationId };
  }

  async getStarredMessages(userId: string) {
    const cacheKey = CacheKeys.starredMessages(userId);
    const cached = await cacheGetVersioned<unknown[]>(cacheKey);
    if (cached?.data) {
      return { stars: cached.data, cacheVersion: cached.version };
    }

    const stars = await prisma.starredMessage.findMany({
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
    const cacheVersion = await cacheSetVersioned(cacheKey, stars, CacheTTL.stars);
    return { stars, cacheVersion };
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

    await cacheInvalidatePattern(`${CacheKeys.messages(conversationId)}:*`);
    await cacheInvalidatePattern(`${CacheKeys.pinnedMessages(conversationId)}:*`);
    return pin;
  }

  async unpinMessage(messageId: string, conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    await prisma.messagePin.deleteMany({ where: { messageId, conversationId } });
    await cacheInvalidatePattern(`${CacheKeys.messages(conversationId)}:*`);
    await cacheInvalidatePattern(`${CacheKeys.pinnedMessages(conversationId)}:*`);
    return { message: 'Message unpinned' };
  }

  async getPinnedMessages(conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const cacheKey = `${CacheKeys.pinnedMessages(conversationId)}:${userId}`;
    const cached = await cacheGetVersioned<unknown[]>(cacheKey);
    if (cached?.data) {
      return { pins: cached.data, cacheVersion: cached.version };
    }

    const pins = await prisma.messagePin.findMany({
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

    const visiblePins = pins.filter((pin) => {
      const msg = pin.message;
      if (msg.deletedForAll || msg.deletedFor.includes(userId)) return false;
      if (participant.clearedAt && msg.createdAt <= participant.clearedAt) return false;
      return true;
    });
    const cacheVersion = await cacheSetVersioned(cacheKey, visiblePins, CacheTTL.pins);
    return { pins: visiblePins, cacheVersion };
  }

  async clearChatForUser(conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const clearedAt = new Date();
    await prisma.participant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { clearedAt, lastReadAt: clearedAt },
    });

    await cacheDel(CacheKeys.userConversations(userId));
    await cacheInvalidatePattern(`${CacheKeys.messages(conversationId)}:*`);
    await cacheInvalidatePattern(`${CacheKeys.pinnedMessages(conversationId)}:*`);

    return { conversationId, clearedAt: clearedAt.toISOString() };
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
