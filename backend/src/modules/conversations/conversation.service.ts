import { prisma } from '../../config/database';
import { cacheDel, CacheKeys } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { friendService } from '../friends/friend.service';
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
      if (!areFriends) throw new AppError(403, 'You can only chat with friends');
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

    const conversationIds = participations.map((p) => p.conversationId);

    const unreadCounts = conversationIds.length > 0
      ? await prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversationIds },
            senderId: { not: userId },
            readAt: null,
            deletedForAll: false,
            NOT: { deletedFor: { has: userId } },
          },
          _count: { id: true },
        })
      : [];

    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));

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
            }
          : null,
        updatedAt: p.conversation.updatedAt.toISOString(),
        unreadCount: unreadMap.get(p.conversation.id) || 0,
      };
    });

    return sortConversations(conversations);
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
    await prisma.participant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    await cacheDel(CacheKeys.userConversations(userId));
    return { message: 'Marked as read' };
  }
}

export const conversationService = new ConversationService();
