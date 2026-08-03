import { Server } from 'socket.io';
import { messageService } from '../modules/messages/message.service';
import { conversationService } from '../modules/conversations/conversation.service';
import { notificationService } from '../modules/notifications/notification.service';
import { emitConversationUpdated } from './conversation.events';

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
