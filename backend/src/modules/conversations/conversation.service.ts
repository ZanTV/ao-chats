import { prisma } from '../../config/database';
import {
  cacheDel,
  cacheGetVersioned,
  cacheSetVersioned,
  CacheKeys,
  CacheTTL,
} from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { friendService } from '../friends/friend.service';
import { messageService } from '../messages/message.service';
import { notificationService } from '../notifications/notification.service';
import { getAoManagerId } from '../../services/ao-manager.service';
import { formatMessagePreview, sortConversations } from '../../utils/conversation.utils';

const participantUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarId: true,
  status: true,
  lastSeen: true,
  isVerified: true,
  isSystemAccount: true,
  bio: true,
};

export class ConversationService {
  async getOrCreateDirectConversation(userId: string, otherUserId: string) {
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

    const existing = await prisma.conversation.findFirst({
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
      },
    });

    if (existing) return existing;

    const conversation = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: {
          include: { user: { select: participantUserSelect } },
        },
      },
    });

    await cacheDel(CacheKeys.userConversations(userId), CacheKeys.userConversations(otherUserId));
    return conversation;
  }

  async getOrCreateAoManagerConversation(userId: string) {
    const managerId = await getAoManagerId();
    if (!managerId) throw new AppError(503, 'AO Manager is not available');
    return this.getOrCreateDirectConversation(userId, managerId);
  }

  async getUserConversations(userId: string) {
    const cacheKey = CacheKeys.userConversations(userId);
    const cached = await cacheGetVersioned<unknown[]>(cacheKey);
    if (cached?.data?.length) {
      return { conversations: cached.data, cacheVersion: cached.version };
    }

    const participations = await prisma.participant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: participantUserSelect } },
            },
            messages: {
              where: {
                deletedForAll: false,
                NOT: { deletedFor: { has: userId } },
                ...(p.clearedAt ? { createdAt: { gt: p.clearedAt } } : {}),
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

    const unreadEntries = await Promise.all(
      participations.map(async (p) => {
        const count = await prisma.message.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: userId },
            createdAt: {
              gt: p.clearedAt && p.lastReadAt
                ? (p.lastReadAt > p.clearedAt ? p.lastReadAt : p.clearedAt)
                : p.clearedAt ?? p.lastReadAt ?? new Date(0),
            },
            deletedForAll: false,
            NOT: { deletedFor: { has: userId } },
          },
        });
        return [p.conversationId, count] as const;
      })
    );
    const unreadMap = new Map(unreadEntries);

    const conversations = participations.map((p) => {
      const otherParticipant = p.conversation.participants.find((pp) => pp.userId !== userId);
      const lastMessage = p.conversation.messages[0] || null;

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
              isEdited: lastMessage.isEdited,
            }
          : null,
        updatedAt: p.conversation.updatedAt.toISOString(),
        unreadCount: unreadMap.get(p.conversation.id) || 0,
      };
    });

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
}

export const conversationService = new ConversationService();
