import { prisma } from '../../config/database';
import { cacheDel, CacheKeys } from '../../config/redis';
import { NotificationType } from '@prisma/client';

export class NotificationService {
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    actorId?: string,
    data?: Record<string, unknown>
  ) {
    const notification = await prisma.notification.create({
      data: { userId, type, title, body, actorId, data: (data || {}) as object },
    });

    await cacheDel(CacheKeys.notifications(userId));
    return notification;
  }

  async getNotifications(userId: string, limit = 50) {
    return prisma.notification.findMany({
      where: { userId },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, avatarId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    await cacheDel(CacheKeys.notifications(userId));
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await cacheDel(CacheKeys.notifications(userId));
    return { message: 'All marked as read' };
  }

  async getSummary(userId: string, limit = 50) {
    const [notifications, unreadCount] = await Promise.all([
      this.getNotifications(userId, limit),
      this.getUnreadCount(userId),
    ]);
    return { notifications, unreadCount };
  }

  async notifyFriendRequest(receiverId: string, senderName: string, senderId: string, requestId: string) {
    return this.create(
      receiverId,
      'FRIEND_REQUEST',
      'New Friend Request',
      `${senderName} sent you a friend request`,
      senderId,
      { requestId }
    );
  }

  async notifyFriendAccepted(
    senderId: string,
    accepterName: string,
    accepterId: string,
    requestId: string
  ) {
    return this.create(
      senderId,
      'FRIEND_ACCEPTED',
      'Friend Request Accepted',
      `${accepterName} accepted your friend request`,
      accepterId,
      { requestId }
    );
  }

  async deleteNotification(notificationId: string, userId: string) {
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    await cacheDel(CacheKeys.notifications(userId));
    return { message: 'Notification deleted' };
  }

  async markConversationNotificationsRead(userId: string, conversationId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        type: 'NEW_MESSAGE',
        data: { path: ['conversationId'], equals: conversationId },
      },
      data: { isRead: true },
    });
    await cacheDel(CacheKeys.notifications(userId));
    return result.count;
  }

  async notifyNewMessage(
    receiverId: string,
    senderName: string,
    senderId: string,
    conversationId: string,
    preview: string
  ) {
    return this.create(
      receiverId,
      'NEW_MESSAGE',
      senderName,
      preview.slice(0, 100),
      senderId,
      { conversationId }
    );
  }
}

export const notificationService = new NotificationService();
