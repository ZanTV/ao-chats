import { prisma } from '../../config/database';
import {
  cacheDel,
  cacheGetVersioned,
  cacheSetVersioned,
  CacheKeys,
  CacheTTL,
} from '../../config/redis';
import { NotificationType } from '@prisma/client';
import { sendPushToUser } from '../../services/push.service';

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
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, avatarId: true },
        },
      },
    });

    await cacheDel(CacheKeys.notifications(userId), CacheKeys.notificationCount(userId));

    const unreadCount = await this.getUnreadCount(userId);
    const pushData = {
      ...(data || {}),
      notificationId: notification.id,
      type,
    } as Record<string, unknown>;

    sendPushToUser(userId, {
      title,
      body,
      sound: 'default',
      badge: unreadCount,
      data: pushData,
      categoryId: type === 'NEW_MESSAGE' ? 'message' : 'social',
    }).catch(() => {});

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
    const cacheKey = CacheKeys.notificationCount(userId);
    const cached = await cacheGetVersioned<number>(cacheKey);
    if (cached?.data !== undefined && cached.data !== null) {
      return cached.data;
    }

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    await cacheSetVersioned(cacheKey, count, CacheTTL.notifications);
    return count;
  }

  async markAsRead(notificationId: string, userId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    await cacheDel(CacheKeys.notifications(userId), CacheKeys.notificationCount(userId));
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await cacheDel(CacheKeys.notifications(userId), CacheKeys.notificationCount(userId));
    return { message: 'All marked as read' };
  }

  async getSummary(userId: string, limit = 50) {
    const cacheKey = CacheKeys.notifications(userId);
    const cached = await cacheGetVersioned<{ notifications: unknown[]; unreadCount: number }>(
      cacheKey
    );
    if (cached?.data) {
      return { ...cached.data, cacheVersion: cached.version };
    }

    const [notifications, unreadCount] = await Promise.all([
      this.getNotifications(userId, limit),
      this.getUnreadCount(userId),
    ]);
    const payload = { notifications, unreadCount };
    const cacheVersion = await cacheSetVersioned(cacheKey, payload, CacheTTL.notifications);
    return { ...payload, cacheVersion };
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
    await cacheDel(CacheKeys.notifications(userId), CacheKeys.notificationCount(userId));
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
    await cacheDel(CacheKeys.notifications(userId), CacheKeys.notificationCount(userId));
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
