import { Router } from 'express';
import { messageService } from './message.service';
import { createAndDispatchMessage } from '../../sockets/message.dispatch';
import { getIO } from '../../sockets';
import {
  sendMessageSchema,
  reactMessageSchema,
  forwardMessageSchema,
  pinMessageSchema,
} from '../auth/auth.validation';
import { validateBody } from '../../middleware/validation';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { paramId } from '../../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/starred',
  asyncHandler(async (req: AuthRequest, res) => {
    const stars = await messageService.getStarredMessages(req.userId!);
    res.json({ stars });
  })
);

router.get(
  '/:conversationId',
  asyncHandler(async (req: AuthRequest, res) => {
    const { cursor, limit } = req.query;
    const messages = await messageService.getMessages(
      paramId(req.params.conversationId),
      req.userId!,
      cursor as string | undefined,
      limit ? parseInt(limit as string) : 50
    );
    res.json({ messages, count: messages.length });
  })
);

router.get(
  '/:conversationId/search',
  asyncHandler(async (req: AuthRequest, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query required' });
      return;
    }
    const messages = await messageService.searchMessages(
      paramId(req.params.conversationId),
      req.userId!,
      q
    );
    res.json({ messages });
  })
);

router.post(
  '/:conversationId',
  validateBody(sendMessageSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const conversationId = paramId(req.params.conversationId);
    const message = await createAndDispatchMessage(
      getIO(),
      conversationId,
      req.userId!,
      req.body.content,
      req.body.type,
      req.body.replyToId,
      req.body.tempId
    );
    res.status(201).json({ message });
  })
);

router.post(
  '/:messageId/star',
  asyncHandler(async (req: AuthRequest, res) => {
    const star = await messageService.starMessage(paramId(req.params.messageId), req.userId!);
    res.status(201).json(star);
  })
);

router.delete(
  '/:messageId/star',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await messageService.unstarMessage(paramId(req.params.messageId), req.userId!);
    res.json(result);
  })
);

router.post(
  '/:messageId/react',
  validateBody(reactMessageSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await messageService.reactToMessage(
      paramId(req.params.messageId),
      req.userId!,
      req.body.emoji
    );
    res.json(result);
  })
);

router.delete(
  '/:messageId',
  asyncHandler(async (req: AuthRequest, res) => {
    const forEveryone = req.query.forEveryone === 'true';
    const result = await messageService.deleteMessage(
      paramId(req.params.messageId),
      req.userId!,
      forEveryone
    );
    res.json(result);
  })
);

router.post(
  '/:messageId/forward',
  validateBody(forwardMessageSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const message = await messageService.forwardMessage(
      paramId(req.params.messageId),
      req.userId!,
      req.body.conversationId
    );
    res.status(201).json(message);
  })
);

router.post(
  '/:conversationId/pin',
  validateBody(pinMessageSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const pin = await messageService.pinMessage(
      req.body.messageId,
      req.userId!,
      paramId(req.params.conversationId)
    );
    res.status(201).json(pin);
  })
);

router.delete(
  '/:conversationId/pin/:messageId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await messageService.unpinMessage(
      paramId(req.params.messageId),
      paramId(req.params.conversationId),
      req.userId!
    );
    res.json(result);
  })
);

router.get(
  '/:conversationId/pins',
  asyncHandler(async (req: AuthRequest, res) => {
    const pins = await messageService.getPinnedMessages(
      paramId(req.params.conversationId),
      req.userId!
    );
    res.json({ pins });
  })
);

export default router;
