import { prisma } from '../../config/database';
import {
  cacheGet,
  cacheSet,
  cacheDel,
  CacheKeys,
  CacheTTL,
} from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { ALL_AVATARS } from '../../config';
import { normalizeMobileNumber } from './user.validation';

/** Full profile — owner only (includes private fields) */
const ownerProfileSelect = {
  id: true,
  email: true,
  emailVerified: true,
  mobileNumber: true,
  username: true,
  firstName: true,
  lastName: true,
  university: true,
  course: true,
  bio: true,
  avatarId: true,
  status: true,
  statusMessage: true,
  lastSeen: true,
  createdAt: true,
  isVerified: true,
} as const;

/** Public profile — visible to friends/other users */
const publicProfileSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  university: true,
  course: true,
  bio: true,
  avatarId: true,
  status: true,
  statusMessage: true,
  lastSeen: true,
  isVerified: true,
  isSystemAccount: true,
} as const;

export class UserService {
  async getProfile(userId: string) {
    const cacheKey = `${CacheKeys.user(userId)}:owner`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: ownerProfileSelect,
    });

    if (!user) throw new AppError(404, 'User not found');
    await cacheSet(cacheKey, user, CacheTTL.user);
    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      username?: string;
      bio?: string;
      university?: string;
      course?: string;
      avatarId?: string;
      statusMessage?: string;
      mobileNumber?: string | null;
    }
  ) {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new AppError(404, 'User not found');
    if (current.isSystemAccount) throw new AppError(403, 'System accounts cannot be modified');

    if (data.avatarId && !ALL_AVATARS.includes(data.avatarId)) {
      throw new AppError(400, 'Invalid avatar selection');
    }

    if (data.username && data.username.toLowerCase() !== current.username) {
      const taken = await prisma.user.findUnique({
        where: { username: data.username.toLowerCase() },
      });
      if (taken) throw new AppError(409, 'Username already taken');
    }

    let mobileNumber: string | null | undefined = undefined;
    if (data.mobileNumber !== undefined) {
      if (data.mobileNumber === null || data.mobileNumber === '') {
        mobileNumber = null;
      } else {
        mobileNumber = normalizeMobileNumber(data.mobileNumber);
        if (!mobileNumber) {
          throw new AppError(400, 'Invalid mobile number. Use international format e.g. +254712345678');
        }
        const phoneTaken = await prisma.user.findFirst({
          where: { mobileNumber, NOT: { id: userId } },
        });
        if (phoneTaken) throw new AppError(409, 'Mobile number already in use');
      }
    }

    const updateData: {
      firstName?: string;
      lastName?: string;
      username?: string;
      bio?: string;
      university?: string;
      course?: string;
      avatarId?: string;
      statusMessage?: string;
      mobileNumber?: string | null;
    } = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.university !== undefined) updateData.university = data.university;
    if (data.course !== undefined) updateData.course = data.course;
    if (data.avatarId !== undefined) updateData.avatarId = data.avatarId;
    if (data.statusMessage !== undefined) updateData.statusMessage = data.statusMessage;
    if (data.username !== undefined) updateData.username = data.username.toLowerCase();
    if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: ownerProfileSelect,
    });

    await cacheDel(CacheKeys.user(userId), `${CacheKeys.user(userId)}:owner`);
    return user;
  }

  async searchUsers(query: string, currentUserId: string, limit = 20) {
    const blockedIds = await this.getBlockedUserIds(currentUserId);

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          { id: { notIn: blockedIds } },
          { emailVerified: true },
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: publicProfileSelect,
      take: limit,
    });

    return users;
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    });

    return blocks.flatMap((b) =>
      b.blockerId === userId ? [b.blockedId] : [b.blockerId]
    );
  }

  async getPublicProfile(userId: string, currentUserId: string) {
    const blockedIds = await this.getBlockedUserIds(currentUserId);
    if (blockedIds.includes(userId)) throw new AppError(404, 'User not found');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicProfileSelect,
    });

    if (!user) throw new AppError(404, 'User not found');
    return user;
  }

  async checkUsernameAvailable(username: string, excludeUserId?: string) {
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    const available = !existing || existing.id === excludeUserId;
    return { available };
  }
}

export const userService = new UserService();
