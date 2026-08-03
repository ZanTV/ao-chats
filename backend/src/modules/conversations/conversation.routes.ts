import { Router } from 'express';
import { conversationService } from './conversation.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { paramId } from '../../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const conversations = await conversationService.getUserConversations(req.userId!);
    res.json({ conversations });
  })
);

router.post(
  '/direct/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const conversation = await conversationService.getOrCreateDirectConversation(
      req.userId!,
      paramId(req.params.userId)
    );
    res.json(conversation);
  })
);

router.get(
  '/support/ao-manager',
  asyncHandler(async (req: AuthRequest, res) => {
    const conversation = await conversationService.getOrCreateAoManagerConversation(req.userId!);
    res.json({ id: conversation.id, conversation });
  })
);

router.post(
  '/support/ao-manager',
  asyncHandler(async (req: AuthRequest, res) => {
    const conversation = await conversationService.getOrCreateAoManagerConversation(req.userId!);
    res.json({ id: conversation.id, conversation });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const conversation = await conversationService.getConversation(paramId(req.params.id), req.userId!);
    res.json(conversation);
  })
);

router.patch(
  '/:id/pin',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await conversationService.togglePinConversation(paramId(req.params.id), req.userId!);
    res.json(result);
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await conversationService.markAsRead(paramId(req.params.id), req.userId!);
    res.json(result);
  })
);

export default router;
