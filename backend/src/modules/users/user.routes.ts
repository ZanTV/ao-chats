import { Router } from 'express';
import { userService } from './user.service';
import { updateProfileSchema } from './user.validation';
import { searchUsersSchema } from '../auth/auth.validation';
import { validateBody, validateQuery } from '../../middleware/validation';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { paramId } from '../../utils/params';

const router = Router();

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
    res.json(profile);
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
