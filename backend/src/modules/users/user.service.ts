import { prisma } from '../../config/database';
import {
  cacheGetVersioned,
  cacheSetVersioned,
  cacheDel,
  CacheKeys,
  CacheTTL,
} from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { ALL_AVATARS } from '../../config';
import { normalizeMobileNumber } from './user.validation';
import { friendService } from '../friends/friend.service';
import { registerPushToken, unregisterPushToken } from '../../services/push.service';
import { uploadService } from '../uploads/upload.service';

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
  avatarUrl: true,
  avatarVersion: true,
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
  avatarUrl: true,
  avatarVersion: true,
  status: true,
  statusMessage: true,
  lastSeen: true,
  isVerified: true,
  isSystemAccount: true,
  updatedAt: true,
} as const;

export class UserService {
  async getProfile(userId: string) {
    const cacheKey = `${CacheKeys.user(userId)}:owner`;
    const cached = await cacheGetVersioned<Record<string, unknown>>(cacheKey);
    if (cached?.data) {
      return { ...cached.data, cacheVersion: cached.version };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: ownerProfileSelect,
    });

    if (!user) throw new AppError(404, 'User not found');
    const cacheVersion = await cacheSetVersioned(cacheKey, user, CacheTTL.user);
    return { ...user, cacheVersion };
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
      avatarUrl?: string | null;
      avatarVersion?: number;
      statusMessage?: string;
      mobileNumber?: string | null;
    } = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.university !== undefined) updateData.university = data.university;
    if (data.course !== undefined) updateData.course = data.course;
    if (data.avatarId !== undefined) {
      updateData.avatarId = data.avatarId;
      // Selecting a default AO avatar clears any custom photo
      if (current.avatarUrl) {
        updateData.avatarUrl = null;
        updateData.avatarVersion = (current.avatarVersion || 0) + 1;
      }
    }
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

  async setProfileAvatar(
    userId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string }
  ) {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new AppError(404, 'User not found');
    if (current.isSystemAccount) throw new AppError(403, 'System accounts cannot be modified');

    const saved = await uploadService.saveProfileAvatar({
      uploaderId: userId,
      buffer: file.buffer,
      originalName: file.originalName,
      mimeType: file.mimeType,
    });

    // Replace previous avatarUrl in DB with the new Agrohub-backed proxy URL
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: saved.url,
        avatarVersion: (current.avatarVersion || 0) + 1,
      },
      select: ownerProfileSelect,
    });

    await cacheDel(CacheKeys.user(userId), `${CacheKeys.user(userId)}:owner`);
    return user;
  }

  async listAvatarGallery(userId: string) {
    const photos = await prisma.profileGalleryPhoto.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
    return photos.map((p) => ({
      id: p.id,
      url: p.url,
      storageKey: p.storageKey,
      fileName: p.fileName,
      mimeType: p.mimeType,
      fileSize: p.fileSize,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async addAvatarGalleryPhoto(
    userId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string }
  ) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isSystemAccount: true },
    });
    if (!current) throw new AppError(404, 'User not found');
    if (current.isSystemAccount) throw new AppError(403, 'System accounts cannot be modified');

    const count = await prisma.profileGalleryPhoto.count({ where: { userId } });
    if (count >= 4) {
      throw new AppError(400, 'My Own DP library is full (max 4 photos).');
    }

    const saved = await uploadService.saveProfileAvatar({
      uploaderId: userId,
      buffer: file.buffer,
      originalName: file.originalName,
      mimeType: file.mimeType,
    });

    const photo = await prisma.profileGalleryPhoto.create({
      data: {
        userId,
        storageKey: saved.storageKey,
        url: saved.url,
        fileName: file.originalName || 'avatar.jpg',
        mimeType: saved.mimeType || file.mimeType,
        fileSize: saved.fileSize,
      },
    });

    return {
      id: photo.id,
      url: photo.url,
      storageKey: photo.storageKey,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      fileSize: photo.fileSize,
      createdAt: photo.createdAt.toISOString(),
    };
  }

  async removeAvatarGalleryPhoto(userId: string, photoId: string) {
    const photo = await prisma.profileGalleryPhoto.findFirst({
      where: { id: photoId, userId },
    });
    if (!photo) throw new AppError(404, 'Photo not found');

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, avatarVersion: true, isSystemAccount: true },
    });
    if (!current) throw new AppError(404, 'User not found');
    if (current.isSystemAccount) throw new AppError(403, 'System accounts cannot be modified');

    await prisma.profileGalleryPhoto.delete({ where: { id: photo.id } });
    await uploadService.deleteStoredFile(photo.storageKey);

    const photoUrlBase = photo.url.split('?')[0];
    const avatarUrlBase = (current.avatarUrl || '').split('?')[0];
    const wasActiveAvatar =
      Boolean(current.avatarUrl) &&
      (avatarUrlBase === photoUrlBase ||
        (current.avatarUrl || '').includes(photo.storageKey));

    let profile: {
      id: string;
      avatarUrl: string | null;
      avatarVersion: number;
      avatarId: string;
      [key: string]: unknown;
    } | null = null;
    let clearedAvatar = false;

    if (wasActiveAvatar) {
      profile = await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: null,
          avatarVersion: (current.avatarVersion || 0) + 1,
        },
        select: ownerProfileSelect,
      });
      clearedAvatar = true;
      await cacheDel(CacheKeys.user(userId), `${CacheKeys.user(userId)}:owner`);
    }

    return {
      success: true as const,
      id: photo.id,
      clearedAvatar,
      profile,
    };
  }

  /**
   * Set an Agrohub gallery photo as the active profile avatar.
   * Clears/replaces previous avatarUrl in DB and bumps avatarVersion.
   */
  async useAvatarGalleryPhoto(userId: string, photoId: string) {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new AppError(404, 'User not found');
    if (current.isSystemAccount) throw new AppError(403, 'System accounts cannot be modified');

    const photo = await prisma.profileGalleryPhoto.findFirst({
      where: { id: photoId, userId },
    });
    if (!photo) throw new AppError(404, 'Photo not found');

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: photo.url,
        avatarVersion: (current.avatarVersion || 0) + 1,
      },
      select: ownerProfileSelect,
    });

    await cacheDel(CacheKeys.user(userId), `${CacheKeys.user(userId)}:owner`);
    return user;
  }

  async clearProfileAvatar(userId: string) {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new AppError(404, 'User not found');
    if (current.isSystemAccount) throw new AppError(403, 'System accounts cannot be modified');
    if (!current.avatarUrl) {
      return prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: ownerProfileSelect,
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarVersion: (current.avatarVersion || 0) + 1,
      },
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

  async searchUsersWithRelationship(query: string, currentUserId: string, limit = 20) {
    const users = await this.searchUsers(query, currentUserId, limit);
    return friendService.enrichUsersWithRelationship(currentUserId, users);
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

  async registerPushToken(userId: string, token: string, platform?: string) {
    await registerPushToken(userId, token, platform);
    return { success: true };
  }

  async unregisterPushToken(userId: string, token: string) {
    await unregisterPushToken(userId, token);
    return { success: true };
  }
}

export const userService = new UserService();
