import { Router } from 'express';
import { notificationService } from './notification.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { paramId } from '../../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const notifications = await notificationService.getNotifications(req.userId!);
    res.json({ notifications });
  })
);

router.get(
  '/unread-count',
  asyncHandler(async (req: AuthRequest, res) => {
    const count = await notificationService.getUnreadCount(req.userId!);
    res.json({ count });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await notificationService.markAsRead(paramId(req.params.id), req.userId!);
    res.json(result);
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await notificationService.markAllAsRead(req.userId!);
    res.json(result);
  })
);

export default router;
