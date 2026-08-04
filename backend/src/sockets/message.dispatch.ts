import { Server } from 'socket.io';
import { messageService } from '../modules/messages/message.service';
import { conversationService } from '../modules/conversations/conversation.service';
import { notificationService } from '../modules/notifications/notification.service';
import { emitConversationUpdated } from './conversation.events';
import { prisma } from '../config/database';

export function emitMessageStatus(
  io: Server,
  conversationId: string,
  payload: {
    messageId: string;
    status: string;
    deliveredAt?: Date;
    readAt?: Date;
    waitingAt?: Date | null;
  }
) {
  io.to(`conversation:${conversationId}`).emit('message:status', payload);
}

export async function deliverPendingMessages(
  io: Server,
  conversationId: string,
  recipientId: string
) {
  const pending = await prisma.message.findMany({
    where: {
      conversationId,
      senderId: { not: recipientId },
      status: { in: ['SENT', 'WAITING'] },
      deliveredAt: null,
      deletedForAll: false,
    },
    select: { id: true },
  });

  for (const msg of pending) {
    const deliveredAt = await messageService.markDelivered(msg.id);
    emitMessageStatus(io, conversationId, {
      messageId: msg.id,
      status: 'DELIVERED',
      deliveredAt,
    });
  }
}

export async function createAndDispatchMessage(
  io: Server | null,
  conversationId: string,
  senderId: string,
  content: string,
  type: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT',
  replyToId?: string,
  tempId?: string
) {
  const message = await messageService.sendMessage(
    conversationId,
    senderId,
    content,
    type,
    replyToId
  );

  if (io) {
    io.to(`conversation:${conversationId}`).emit('message:new', {
      ...message,
      tempId,
    });

    if (replyToId) {
      io.to(`conversation:${conversationId}`).emit('message:reply', {
        ...message,
        tempId,
      });
    }

    emitMessageStatus(io, conversationId, {
      messageId: message.id,
      status: message.status,
      waitingAt: message.waitingAt,
    });

    await emitConversationUpdated(io, conversationId, message);

    try {
      const conversation = await conversationService.getConversation(conversationId, senderId);
      const otherParticipant = conversation.participants.find((p) => p.userId !== senderId);
      const sender = conversation.participants.find((p) => p.userId === senderId);

      if (otherParticipant && sender) {
        await notificationService.notifyNewMessage(
          otherParticipant.userId,
          sender.user.firstName,
          senderId,
          conversationId,
          content
        );
        io.to(`user:${otherParticipant.userId}`).emit('notification:new', {
          type: 'NEW_MESSAGE',
          conversationId,
        });
      }
    } catch {
      // notifications optional
    }
  }

  return message;
}
