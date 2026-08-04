import { Server } from 'socket.io';
import { prisma } from '../config/database';
import { cacheDel, CacheKeys } from '../config/redis';
import { formatMessagePreview } from '../utils/conversation.utils';

export async function emitConversationUpdated(
  io: Server,
  conversationId: string,
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    type: string;
    createdAt: Date | string;
    readAt?: Date | string | null;
    isDeleted?: boolean;
    deletedForAll?: boolean;
    sender?: { firstName: string };
  },
  options?: {
    reactionEmoji?: string;
    reactorId?: string;
    readerId?: string;
    unreadCount?: number;
  }
) {
  const participants = await prisma.participant.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  const updatedAt = new Date().toISOString();

  for (const { userId } of participants) {
    await cacheDel(CacheKeys.userConversations(userId));

    let payloadLastMessage: Record<string, unknown> | undefined;
    if (lastMessage) {
      const createdAt =
        typeof lastMessage.createdAt === 'string'
          ? lastMessage.createdAt
          : lastMessage.createdAt.toISOString();

      let preview: string;
      if (options?.reactionEmoji && options.reactorId) {
        const reactor = await prisma.user.findUnique({
          where: { id: options.reactorId },
          select: { firstName: true },
        });
        const name = options.reactorId === userId ? 'You' : (reactor?.firstName || 'Someone');
        preview = `${name} reacted ${options.reactionEmoji}`;
      } else {
        preview = formatMessagePreview(
          {
            content: lastMessage.content,
            type: lastMessage.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM',
            senderId: lastMessage.senderId,
            isDeleted: lastMessage.isDeleted,
            deletedForAll: lastMessage.deletedForAll,
          },
          userId,
          lastMessage.sender?.firstName
        );
      }

      payloadLastMessage = {
        id: lastMessage.id,
        content: lastMessage.content,
        preview,
        senderId: lastMessage.senderId,
        senderName: lastMessage.sender?.firstName,
        type: lastMessage.type,
        createdAt,
        isRead: !!lastMessage.readAt,
      };
    }

    const payload = {
      conversationId,
      updatedAt,
      lastMessage: payloadLastMessage,
      unreadCount:
        options?.readerId === userId
          ? 0
          : options?.unreadCount !== undefined
            ? options.unreadCount
            : undefined,
    };

    io.to(`user:${userId}`).emit('conversation:updated', payload);
    io.to(`user:${userId}`).emit('conversation:update', payload);
  }
}
