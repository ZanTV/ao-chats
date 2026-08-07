import { Router } from 'express';
import { friendService } from './friend.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { paramId } from '../../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res) => {
    const stats = await friendService.getStats(req.userId!);
    res.json(stats);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await friendService.getFriends(req.userId!);
    res.json(result);
  })
);

router.get(
  '/requests/pending',
  asyncHandler(async (req: AuthRequest, res) => {
    const requests = await friendService.getPendingRequests(req.userId!);
    res.json({ requests });
  })
);

router.get(
  '/requests/sent',
  asyncHandler(async (req: AuthRequest, res) => {
    const requests = await friendService.getSentRequests(req.userId!);
    res.json({ requests });
  })
);

router.post(
  '/request/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await friendService.sendRequest(req.userId!, paramId(req.params.userId));
    res.status(201).json(request);
  })
);

router.patch(
  '/request/:requestId',
  asyncHandler(async (req: AuthRequest, res) => {
    const { accept } = req.body;
    const result = await friendService.respondToRequest(
      paramId(req.params.requestId),
      req.userId!,
      accept === true
    );
    res.json(result);
  })
);

router.delete(
  '/:friendId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await friendService.removeFriend(req.userId!, paramId(req.params.friendId));
    res.json(result);
  })
);

router.post(
  '/block/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await friendService.blockUser(req.userId!, paramId(req.params.userId));
    res.json(result);
  })
);

router.delete(
  '/block/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await friendService.unblockUser(req.userId!, paramId(req.params.userId));
    res.json(result);
  })
);

router.get(
  '/blocked',
  asyncHandler(async (req: AuthRequest, res) => {
    const blocked = await friendService.getBlockedUsers(req.userId!);
    res.json({ blocked });
  })
);

export default router;
