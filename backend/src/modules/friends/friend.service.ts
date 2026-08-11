import { prisma } from '../../config/database';
import {
  cacheDel,
  cacheGetVersioned,
  cacheSetVersioned,
  cacheInvalidatePattern,
  CacheKeys,
  CacheTTL,
} from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { notificationService } from '../notifications/notification.service';
import { getIO } from '../../sockets';
import { directConversationPairKey } from '../../utils/conversation.utils';
import { userService } from '../users/user.service';

async function assertNotSystemAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSystemAccount: true },
  });
  if (user?.isSystemAccount) {
    throw new AppError(403, 'This official account cannot be modified');
  }
}

export class FriendService {
  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) throw new AppError(400, 'Cannot send request to yourself');

    const blockedIds = await userService.getBlockedUserIds(senderId);
    if (blockedIds.includes(receiverId)) throw new AppError(403, 'Cannot send request to this user');

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new AppError(404, 'User not found');

    const existingFriendship = await this.areFriends(senderId, receiverId);
    if (existingFriendship) throw new AppError(409, 'Already friends');

    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId, status: 'PENDING' },
          { senderId: receiverId, receiverId: senderId, status: 'PENDING' },
        ],
      },
    });
    if (existingRequest) throw new AppError(409, 'Friend request already exists');

    const request = await prisma.friendRequest.create({
      data: { senderId, receiverId },
      include: {
        sender: {
          select: { id: true, username: true, firstName: true, lastName: true, avatarId: true, avatarUrl: true, avatarVersion: true },
        },
      },
    });

    await cacheDel(CacheKeys.userFriends(senderId), CacheKeys.userFriends(receiverId));

    const senderName = `${request.sender.firstName} ${request.sender.lastName}`.trim();
    try {
      await notificationService.notifyFriendRequest(
        receiverId,
        senderName,
        senderId,
        request.id
      );
      const io = getIO();
      io?.to(`user:${receiverId}`).emit('friend:request', {
        request,
        unreadCount: await notificationService.getUnreadCount(receiverId),
      });
      io?.to(`user:${receiverId}`).emit('notification:new', {
        type: 'FRIEND_REQUEST',
        requestId: request.id,
      });
    } catch {
      // notifications optional
    }

    return request;
  }

  async respondToRequest(requestId: string, userId: string, accept: boolean) {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: { sender: true, receiver: true },
    });

    if (!request) throw new AppError(404, 'Request not found');
    if (request.receiverId !== userId) throw new AppError(403, 'Not authorized');
    if (request.status !== 'PENDING') throw new AppError(400, 'Request already processed');

    if (!accept) {
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });
      return { message: 'Request rejected' };
    }

    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      prisma.friendship.create({
        data: {
          user1Id: request.senderId < request.receiverId ? request.senderId : request.receiverId,
          user2Id: request.senderId < request.receiverId ? request.receiverId : request.senderId,
        },
      }),
    ]);

    await cacheDel(
      CacheKeys.userFriends(request.senderId),
      CacheKeys.userFriends(request.receiverId)
    );

    try {
      const receiverName = `${request.receiver.firstName} ${request.receiver.lastName}`.trim();
      await notificationService.notifyFriendAccepted(
        request.senderId,
        receiverName,
        request.receiverId,
        requestId
      );
      const io = getIO();
      io?.to(`user:${request.senderId}`).emit('friend:accepted', {
        friend: request.receiver,
        requestId,
      });
      io?.to(`user:${request.senderId}`).emit('notification:new', {
        type: 'FRIEND_ACCEPTED',
        requestId,
      });
    } catch {
      // notifications optional
    }

    return { message: 'Friend request accepted', friend: request.sender };
  }

  async cancelRequest(requestId: string, userId: string) {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new AppError(404, 'Request not found');
    if (request.senderId !== userId) throw new AppError(403, 'Not authorized');
    if (request.status !== 'PENDING') throw new AppError(400, 'Request already processed');

    await prisma.friendRequest.delete({ where: { id: requestId } });
    await cacheDel(CacheKeys.userFriends(request.senderId), CacheKeys.userFriends(request.receiverId));

    try {
      const io = getIO();
      io?.to(`user:${request.receiverId}`).emit('friend:request:cancelled', {
        requestId,
        senderId: request.senderId,
      });
    } catch {
      // optional
    }

    return { message: 'Request cancelled' };
  }

  async getFriends(userId: string) {
    const cacheKey = CacheKeys.userFriends(userId);
    const cached = await cacheGetVersioned<unknown[]>(cacheKey);
    if (cached?.data) {
      return { friends: cached.data, cacheVersion: cached.version };
    }

    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: {
          select: {
            id: true, username: true, firstName: true, lastName: true,
            avatarId: true, avatarUrl: true, avatarVersion: true, status: true, lastSeen: true, university: true,
          },
        },
        user2: {
          select: {
            id: true, username: true, firstName: true, lastName: true,
            avatarId: true, avatarUrl: true, avatarVersion: true, status: true, lastSeen: true, university: true,
          },
        },
      },
    });

    const friends = friendships.map((f) => (f.user1Id === userId ? f.user2 : f.user1));
    const cacheVersion = await cacheSetVersioned(cacheKey, friends, CacheTTL.friends);
    return { friends, cacheVersion };
  }

  async getPendingRequests(userId: string) {
    return prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: {
          select: {
            id: true, username: true, firstName: true, lastName: true,
            avatarId: true, avatarUrl: true, avatarVersion: true, university: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSentRequests(userId: string) {
    return prisma.friendRequest.findMany({
      where: { senderId: userId, status: 'PENDING' },
      include: {
        receiver: {
          select: {
            id: true, username: true, firstName: true, lastName: true, avatarId: true, avatarUrl: true, avatarVersion: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeFriend(userId: string, friendId: string) {
    await assertNotSystemAccount(friendId);
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: friendId },
          { user1Id: friendId, user2Id: userId },
        ],
      },
    });

    if (!friendship) throw new AppError(404, 'Friendship not found');

    await prisma.friendship.delete({ where: { id: friendship.id } });
    await cacheDel(CacheKeys.userFriends(userId), CacheKeys.userFriends(friendId));

    return { message: 'Friend removed' };
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new AppError(400, 'Cannot block yourself');
    await assertNotSystemAccount(blockedId);

    await prisma.$transaction(async (tx) => {
      await tx.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      });

      await tx.friendship.deleteMany({
        where: {
          OR: [
            { user1Id: blockerId, user2Id: blockedId },
            { user1Id: blockedId, user2Id: blockerId },
          ],
        },
      });

      await tx.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: blockerId, receiverId: blockedId },
            { senderId: blockedId, receiverId: blockerId },
          ],
        },
      });
    });

    await cacheDel(CacheKeys.userFriends(blockerId), CacheKeys.userFriends(blockedId));
    return { message: 'User blocked' };
  }

  async unblockUser(
    blockerId: string,
    blockedId: string,
    options?: { restoreHistory?: boolean }
  ) {
    const restoreHistory = options?.restoreHistory === true;

    await prisma.block.deleteMany({ where: { blockerId, blockedId } });

    const pairKey = directConversationPairKey(blockerId, blockedId);
    const conversation = await prisma.conversation.findFirst({
      where: { isGroup: false, directPairKey: pairKey },
      select: { id: true },
    });

    let conversationId: string | null = null;
    if (conversation) {
      conversationId = conversation.id;
      const now = new Date();
      await prisma.participant.updateMany({
        where: { conversationId: conversation.id, userId: blockerId },
        data: restoreHistory
          ? {
              // Show chat again with previous messages
              hiddenAt: null,
              clearedAt: null,
            }
          : {
              // Show chat again but empty for this user
              hiddenAt: null,
              clearedAt: now,
              lastReadAt: now,
            },
      });

      await cacheDel(CacheKeys.userConversations(blockerId));
      await cacheInvalidatePattern(`${CacheKeys.messages(conversation.id)}:*`);
      await cacheInvalidatePattern(`${CacheKeys.pinnedMessages(conversation.id)}:*`);
    }

    await cacheDel(CacheKeys.userFriends(blockerId), CacheKeys.userFriends(blockedId));

    return {
      message: 'User unblocked',
      conversationId,
      restoreHistory,
    };
  }

  async getBlockedUsers(userId: string) {
    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true, username: true, firstName: true, lastName: true, avatarId: true, avatarUrl: true, avatarVersion: true,
          },
        },
      },
    });
    return blocks.map((b) => b.blocked);
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId1, user2Id: userId2 },
          { user1Id: userId2, user2Id: userId1 },
        ],
      },
    });
    return !!friendship;
  }

  async hasPendingConnection(userId1: string, userId2: string): Promise<boolean> {
    const pending = await prisma.friendRequest.findFirst({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
    });
    return !!pending;
  }

  async getStats(userId: string) {
    const [friendCount, pendingReceivedCount, pendingSentCount] = await Promise.all([
      prisma.friendship.count({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      }),
      prisma.friendRequest.count({
        where: { receiverId: userId, status: 'PENDING' },
      }),
      prisma.friendRequest.count({
        where: { senderId: userId, status: 'PENDING' },
      }),
    ]);
    return { friendCount, pendingReceivedCount, pendingSentCount };
  }

  async enrichUsersWithRelationship<T extends { id: string }>(
    currentUserId: string,
    users: T[]
  ): Promise<Array<T & { relationship: 'none' | 'friend' | 'pending_sent' | 'pending_received' }>> {
    if (users.length === 0) return [];

    const ids = users.map((u) => u.id);
    const [friendships, pendingRequests] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          OR: [
            { user1Id: currentUserId, user2Id: { in: ids } },
            { user2Id: currentUserId, user1Id: { in: ids } },
          ],
        },
      }),
      prisma.friendRequest.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { senderId: currentUserId, receiverId: { in: ids } },
            { senderId: { in: ids }, receiverId: currentUserId },
          ],
        },
      }),
    ]);

    const friendIds = new Set(
      friendships.map((f) => (f.user1Id === currentUserId ? f.user2Id : f.user1Id))
    );
    const sentIds = new Set(
      pendingRequests.filter((r) => r.senderId === currentUserId).map((r) => r.receiverId)
    );
    const receivedIds = new Set(
      pendingRequests.filter((r) => r.receiverId === currentUserId).map((r) => r.senderId)
    );

    return users.map((user) => {
      let relationship: 'none' | 'friend' | 'pending_sent' | 'pending_received' = 'none';
      if (friendIds.has(user.id)) relationship = 'friend';
      else if (sentIds.has(user.id)) relationship = 'pending_sent';
      else if (receivedIds.has(user.id)) relationship = 'pending_received';
      return { ...user, relationship };
    });
  }
}

export const friendService = new FriendService();
