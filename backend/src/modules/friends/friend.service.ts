import { prisma } from '../../config/database';
import { cacheDel, CacheKeys } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';

async function assertNotSystemAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSystemAccount: true },
  });
  if (user?.isSystemAccount) {
    throw new AppError(403, 'This official account cannot be modified');
  }
}
import { userService } from '../users/user.service';

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
          select: { id: true, username: true, firstName: true, lastName: true, avatarId: true },
        },
      },
    });

    await cacheDel(CacheKeys.userFriends(senderId), CacheKeys.userFriends(receiverId));

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

    return { message: 'Friend request accepted', friend: request.sender };
  }

  async getFriends(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: {
          select: {
            id: true, username: true, firstName: true, lastName: true,
            avatarId: true, status: true, lastSeen: true, university: true,
          },
        },
        user2: {
          select: {
            id: true, username: true, firstName: true, lastName: true,
            avatarId: true, status: true, lastSeen: true, university: true,
          },
        },
      },
    });

    return friendships.map((f) => (f.user1Id === userId ? f.user2 : f.user1));
  }

  async getPendingRequests(userId: string) {
    return prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: {
          select: {
            id: true, username: true, firstName: true, lastName: true,
            avatarId: true, university: true,
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
            id: true, username: true, firstName: true, lastName: true, avatarId: true,
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

  async unblockUser(blockerId: string, blockedId: string) {
    await prisma.block.deleteMany({ where: { blockerId, blockedId } });
    return { message: 'User unblocked' };
  }

  async getBlockedUsers(userId: string) {
    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true, username: true, firstName: true, lastName: true, avatarId: true,
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
}

export const friendService = new FriendService();
