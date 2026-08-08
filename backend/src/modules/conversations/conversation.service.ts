import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import {
  cacheDel,
  cacheGetVersioned,
  cacheInvalidatePattern,
  cacheSetVersioned,
  CacheKeys,
  CacheTTL,
} from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { friendService } from '../friends/friend.service';
import { messageService } from '../messages/message.service';
import { notificationService } from '../notifications/notification.service';
import { getAoManagerId } from '../../services/ao-manager.service';
import {
  directConversationPairKey,
  formatMessagePreview,
  sortConversations,
} from '../../utils/conversation.utils';
import { fetchUnreadCountsByConversation } from './unreadCounts';

const listParticipantUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarId: true,
  status: true,
  lastSeen: true,
  isVerified: true,
  isSystemAccount: true,
} as const;

const participantUserSelect = {
  ...listParticipantUserSelect,
  bio: true,
};

const conversationWithParticipants = {
  participants: {
    include: { user: { select: participantUserSelect } },
  },
} as const;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export class ConversationService {
  private async loadDirectConversationByPairKey(pairKey: string) {
    return prisma.conversation.findUnique({
      where: { directPairKey: pairKey },
      include: conversationWithParticipants,
    });
  }

  /** Exact 2-party DM for this pair (ignores groups / larger rooms). */
  private async findLegacyExactDirectPair(userId: string, otherUserId: string) {
    const candidates = await prisma.conversation.findMany({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: {
          include: { user: { select: participantUserSelect } },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const exact = candidates.filter((c) => c.participants.length === 2);
    if (exact.length === 0) return null;

    exact.sort((a, b) => {
      if (b._count.messages !== a._count.messages) return b._count.messages - a._count.messages;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return exact[0];
  }

  async getOrCreateDirectConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new AppError(400, 'Cannot start a conversation with yourself');
    }

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, isSystemAccount: true },
    });
    if (!otherUser) throw new AppError(404, 'User not found');

    if (!otherUser.isSystemAccount) {
      const areFriends = await friendService.areFriends(userId, otherUserId);
      const hasPending = await friendService.hasPendingConnection(userId, otherUserId);
      if (!areFriends && !hasPending) {
        throw new AppError(403, 'Send a friend request or accept a pending request to start chatting');
      }
    }

    const pairKey = directConversationPairKey(userId, otherUserId);

    const byKey = await this.loadDirectConversationByPairKey(pairKey);
    if (byKey) {
      await cacheDel(CacheKeys.userConversations(userId), CacheKeys.userConversations(otherUserId));
      return byKey;
    }

    const legacy = await this.findLegacyExactDirectPair(userId, otherUserId);
    if (legacy) {
      if (!legacy.directPairKey) {
        try {
          const updated = await prisma.conversation.update({
            where: { id: legacy.id },
            data: { directPairKey: pairKey },
            include: conversationWithParticipants,
          });
          await cacheDel(CacheKeys.userConversations(userId), CacheKeys.userConversations(otherUserId));
          return updated;
        } catch (err) {
          if (isUniqueViolation(err)) {
            const winner = await this.loadDirectConversationByPairKey(pairKey);
            if (winner) return winner;
          }
          throw err;
        }
      }
      return legacy;
    }

    try {
      const conversation = await prisma.conversation.create({
        data: {
          isGroup: false,
          directPairKey: pairKey,
          participants: {
            create: [{ userId }, { userId: otherUserId }],
          },
        },
        include: conversationWithParticipants,
      });
      await cacheDel(CacheKeys.userConversations(userId), CacheKeys.userConversations(otherUserId));
      return conversation;
    } catch (err) {
      if (isUniqueViolation(err)) {
        const existing = await this.loadDirectConversationByPairKey(pairKey);
        if (existing) return existing;
      }
      throw err;
    }
  }

  async getOrCreateAoManagerConversation(userId: string) {
    const managerId = await getAoManagerId();
    if (!managerId) throw new AppError(503, 'AO Manager is not available');
    return this.getOrCreateDirectConversation(userId, managerId);
  }

  async getUserConversations(userId: string) {
    const cacheKey = CacheKeys.userConversations(userId);
    const cached = await cacheGetVersioned<unknown[]>(cacheKey);
    if (cached) {
      return { conversations: cached.data, cacheVersion: cached.version };
    }

    const participations = await prisma.participant.findMany({
      where: { userId, hiddenAt: null },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: listParticipantUserSelect } },
            },
            messages: {
              where: {
                deletedForAll: false,
                NOT: { deletedFor: { has: userId } },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: { select: { id: true, firstName: true } },
                reactions: { select: { emoji: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    const unreadMap = await fetchUnreadCountsByConversation(userId);

    type ListItem = {
      id: string;
      isPinned: boolean;
      otherUser: (typeof participations)[number]['conversation']['participants'][number]['user'] | null;
      lastMessage: {
        id: string;
        content: string;
        preview: string | null;
        senderId: string;
        senderName: string;
        type: string;
        createdAt: string;
        isRead: boolean;
        status: string;
        deliveredAt: string | undefined;
        readAt: string | undefined;
        waitingAt: string | undefined;
        isEdited: boolean;
      } | null;
      updatedAt: string;
      unreadCount: number;
      _isGroup: boolean;
    };

    const mapped: ListItem[] = participations.map((p) => {
      const otherParticipant = p.conversation.participants.find((pp) => pp.userId !== userId);
      const latestMessage = p.conversation.messages[0] || null;
      const lastMessage =
        latestMessage && p.clearedAt && latestMessage.createdAt <= p.clearedAt
          ? null
          : latestMessage;

      let preview: string | null = null;
      if (lastMessage) {
        if (lastMessage.reactions.length > 0 && lastMessage.type === 'TEXT') {
          const reactor = lastMessage.senderId === userId ? 'You' : lastMessage.sender.firstName;
          preview = `${reactor} reacted ${lastMessage.reactions[0].emoji}`;
        } else {
          preview = formatMessagePreview(
            lastMessage,
            userId,
            lastMessage.sender.firstName
          );
        }
      }

      return {
        id: p.conversation.id,
        isPinned: p.isPinned,
        otherUser: otherParticipant?.user || null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              preview,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.firstName,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt.toISOString(),
              isRead: !!lastMessage.readAt,
              status: lastMessage.status,
              deliveredAt: lastMessage.deliveredAt?.toISOString(),
              readAt: lastMessage.readAt?.toISOString(),
              waitingAt: lastMessage.waitingAt?.toISOString(),
              isEdited: lastMessage.isEdited,
            }
          : null,
        updatedAt: p.conversation.updatedAt.toISOString(),
        unreadCount: unreadMap.get(p.conversation.id) || 0,
        _isGroup: p.conversation.isGroup,
      };
    });

    // Defense-in-depth: one list row per DM peer (groups untouched).
    const groups: ListItem[] = [];
    const dmByPeer = new Map<string, ListItem>();
    for (const item of mapped) {
      if (item._isGroup || !item.otherUser) {
        groups.push(item);
        continue;
      }
      const peerId = item.otherUser.id;
      const existing = dmByPeer.get(peerId);
      if (!existing) {
        dmByPeer.set(peerId, item);
        continue;
      }
      const preferItem =
        new Date(item.updatedAt).getTime() >= new Date(existing.updatedAt).getTime();
      if (preferItem) {
        console.warn(
          `[conversations] duplicate DM peer=${peerId} keeping=${item.id} dropping=${existing.id}`
        );
        dmByPeer.set(peerId, item);
      } else {
        console.warn(
          `[conversations] duplicate DM peer=${peerId} keeping=${existing.id} dropping=${item.id}`
        );
      }
    }

    const conversations = [...groups, ...dmByPeer.values()].map(({ _isGroup, ...rest }) => rest);

    const sorted = sortConversations(conversations);
    const cacheVersion = await cacheSetVersioned(cacheKey, sorted, CacheTTL.conversations);
    return { conversations: sorted, cacheVersion };
  }

  async getConversation(conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: { select: participantUserSelect } },
        },
      },
    });

    if (!conversation) throw new AppError(404, 'Conversation not found');
    return conversation;
  }

  async togglePinConversation(conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const updated = await prisma.participant.update({
      where: { id: participant.id },
      data: { isPinned: !participant.isPinned },
    });

    await cacheDel(CacheKeys.userConversations(userId));
    return { isPinned: updated.isPinned };
  }

  async markAsRead(conversationId: string, userId: string) {
    const now = new Date();
    await prisma.participant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: now },
    });

    const { readAt, count } = await messageService.markMessagesRead(conversationId, userId);
    const notificationsMarked = await notificationService.markConversationNotificationsRead(
      userId,
      conversationId
    );

    await cacheDel(CacheKeys.userConversations(userId), CacheKeys.notifications(userId));
    return {
      message: 'Marked as read',
      readAt,
      count,
      notificationsMarked,
      unreadCount: 0,
    };
  }

  async clearChat(conversationId: string, userId: string) {
    return messageService.clearChatForUser(conversationId, userId);
  }

  async hideConversation(conversationId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError(403, 'Not a participant');

    const now = new Date();
    await prisma.participant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        hiddenAt: now,
        clearedAt: now,
        lastReadAt: now,
        isPinned: false,
      },
    });

    await cacheDel(CacheKeys.userConversations(userId));
    await cacheInvalidatePattern(`${CacheKeys.messages(conversationId)}:*`);
    await cacheInvalidatePattern(`${CacheKeys.pinnedMessages(conversationId)}:*`);

    return { conversationId, hiddenAt: now.toISOString() };
  }

  async hideAllConversations(userId: string) {
    const now = new Date();
    const participations = await prisma.participant.findMany({
      where: { userId, hiddenAt: null },
      select: { conversationId: true },
    });

    const result = await prisma.participant.updateMany({
      where: { userId, hiddenAt: null },
      data: {
        hiddenAt: now,
        clearedAt: now,
        lastReadAt: now,
        isPinned: false,
      },
    });

    await cacheDel(CacheKeys.userConversations(userId));
    for (const p of participations) {
      await cacheInvalidatePattern(`${CacheKeys.messages(p.conversationId)}:*`);
    }

    return { hiddenCount: result.count, hiddenAt: now.toISOString() };
  }
}

export const conversationService = new ConversationService();
