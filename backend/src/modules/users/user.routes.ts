import { Router } from 'express';
import multer from 'multer';
import { userService } from './user.service';
import { updateProfileSchema } from './user.validation';
import { searchUsersSchema } from '../auth/auth.validation';
import { validateBody, validateQuery } from '../../middleware/validation';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { paramId } from '../../utils/params';
import { UPLOAD_LIMITS } from '../../utils/attachment';
import { getIO } from '../../sockets';

const router = Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.maxImageBytes },
});

function emitProfileUpdated(
  userId: string,
  avatarVersion: number,
  avatarUrl?: string | null
) {
  const io = getIO();
  if (!io) return;
  // Proxy URL only — never signed Agrohub URLs or secrets.
  io.emit('profile_updated', {
    userId,
    avatarVersion,
    avatarUrl: avatarUrl ?? null,
    updatedAt: new Date().toISOString(),
  });
}

router.use(authenticate);

router.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await userService.getProfile(req.userId!);
    res.json(profile);
  })
);

router.patch(
  '/me',
  validateBody(updateProfileSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await userService.updateProfile(req.userId!, req.body);
    if (req.body?.avatarId) {
      emitProfileUpdated(
        req.userId!,
        profile.avatarVersion ?? 0,
        profile.avatarUrl ?? null
      );
    }
    res.json(profile);
  })
);

router.post(
  '/me/avatar',
  avatarUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'No image uploaded.');
    try {
      const profile = await userService.setProfileAvatar(req.userId!, {
        buffer: file.buffer,
        originalName: file.originalname || 'avatar.jpg',
        mimeType: file.mimetype,
      });
      emitProfileUpdated(
        req.userId!,
        profile.avatarVersion ?? 0,
        profile.avatarUrl ?? null
      );
      res.json(profile);
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
        throw new AppError(400, 'This file is too large to upload.');
      }
      throw err;
    }
  })
);

router.delete(
  '/me/avatar',
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await userService.clearProfileAvatar(req.userId!);
    emitProfileUpdated(
      req.userId!,
      profile.avatarVersion ?? 0,
      profile.avatarUrl ?? null
    );
    res.json(profile);
  })
);

router.get(
  '/me/avatar-gallery',
  asyncHandler(async (req: AuthRequest, res) => {
    const photos = await userService.listAvatarGallery(req.userId!);
    res.json({ photos });
  })
);

router.post(
  '/me/avatar-gallery',
  avatarUpload.array('files', 12),
  asyncHandler(async (req: AuthRequest, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) throw new AppError(400, 'No images uploaded.');
    const photos = [];
    try {
      for (const file of files) {
        const photo = await userService.addAvatarGalleryPhoto(req.userId!, {
          buffer: file.buffer,
          originalName: file.originalname || 'avatar.jpg',
          mimeType: file.mimetype,
        });
        photos.push(photo);
      }
      res.status(201).json({ photos });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
        throw new AppError(400, 'This file is too large to upload.');
      }
      throw err;
    }
  })
);

router.delete(
  '/me/avatar-gallery/:photoId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await userService.removeAvatarGalleryPhoto(
      req.userId!,
      paramId(req.params.photoId)
    );
    res.json(result);
  })
);

router.post(
  '/me/avatar-gallery/:photoId/use',
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await userService.useAvatarGalleryPhoto(
      req.userId!,
      paramId(req.params.photoId)
    );
    emitProfileUpdated(
      req.userId!,
      profile.avatarVersion ?? 0,
      profile.avatarUrl ?? null
    );
    res.json(profile);
  })
);

router.post(
  '/push-token',
  asyncHandler(async (req: AuthRequest, res) => {
    const { token, platform } = req.body as { token?: string; platform?: string };
    if (!token?.trim()) {
      res.status(400).json({ error: 'Push token is required' });
      return;
    }
    await userService.registerPushToken(req.userId!, token.trim(), platform);
    res.json({ success: true });
  })
);

router.delete(
  '/push-token',
  asyncHandler(async (req: AuthRequest, res) => {
    const { token } = req.body as { token?: string };
    if (!token?.trim()) {
      res.status(400).json({ error: 'Push token is required' });
      return;
    }
    await userService.unregisterPushToken(req.userId!, token.trim());
    res.json({ success: true });
  })
);

router.get(
  '/search',
  validateQuery(searchUsersSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { q, limit } = req.query as { q: string; limit?: string };
    const users = await userService.searchUsersWithRelationship(q, req.userId!, limit ? parseInt(limit) : 20);
    res.json({ users });
  })
);

router.get(
  '/check-username/:username',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await userService.checkUsernameAvailable(
      paramId(req.params.username),
      req.userId!
    );
    res.json(result);
  })
);

router.get(
  '/:id/public',
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await userService.getPublicProfile(paramId(req.params.id), req.userId!);
    res.json(user);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await userService.getPublicProfile(paramId(req.params.id), req.userId!);
    res.json(user);
  })
);

export default router;
