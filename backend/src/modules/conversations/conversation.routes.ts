import { Router } from 'express';
import { conversationService } from './conversation.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { paramId } from '../../utils/params';
import { getIO } from '../../sockets';
import { emitConversationUpdated } from '../../sockets/conversation.events';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await conversationService.getUserConversations(req.userId!);
    res.json(result);
  })
);

router.post(
  '/hide-all',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await conversationService.hideAllConversations(req.userId!);
    const io = getIO();
    if (io) {
      io.to(`user:${req.userId}`).emit('conversation:hide-all', result);
    }
    res.json(result);
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
    const conversationId = paramId(req.params.id);
    const result = await conversationService.markAsRead(conversationId, req.userId!);
    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:read', {
        conversationId,
        userId: req.userId,
        readAt: result.readAt,
      });
      io.to(`conversation:${conversationId}`).emit('message:status:bulk', {
        conversationId,
        status: 'READ',
        readAt: result.readAt,
        readerId: req.userId,
      });
      if (result.notificationsMarked > 0) {
        io.to(`user:${req.userId}`).emit('notification:read', {
          conversationId,
          count: result.notificationsMarked,
        });
      }
      await emitConversationUpdated(io, conversationId, undefined, {
        readerId: req.userId!,
      });
    }
    res.json(result);
  })
);

router.post(
  '/:id/clear',
  asyncHandler(async (req: AuthRequest, res) => {
    const conversationId = paramId(req.params.id);
    const result = await conversationService.clearChat(conversationId, req.userId!);
    const io = getIO();
    if (io) {
      io.to(`user:${req.userId}`).emit('conversation:cleared', result);
      await emitConversationUpdated(io, conversationId, undefined, {
        targetUserId: req.userId!,
        unreadCount: 0,
        clearLastMessage: true,
      });
    }
    res.json(result);
  })
);

router.post(
  '/:id/hide',
  asyncHandler(async (req: AuthRequest, res) => {
    const conversationId = paramId(req.params.id);
    const mode = req.body?.mode === 'remove' ? 'remove' : 'delete';
    const clearHistory = mode !== 'remove';
    const result = await conversationService.hideConversation(conversationId, req.userId!, {
      clearHistory,
    });
    const io = getIO();
    if (io) {
      io.to(`user:${req.userId}`).emit('conversation:hidden', result);
      await emitConversationUpdated(io, conversationId, undefined, {
        targetUserId: req.userId!,
        unreadCount: 0,
        clearLastMessage: clearHistory,
        removeFromList: true,
      });
    }
    res.json(result);
  })
);

router.get(
  '/:id/media/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const summary = await conversationService.getSharedMediaSummary(
      paramId(req.params.id),
      req.userId!
    );
    res.json(summary);
  })
);

router.get(
  '/:id/media',
  asyncHandler(async (req: AuthRequest, res) => {
    const typeRaw = String(req.query.type || 'image').toLowerCase();
    const allowed = new Set(['image', 'video', 'document', 'link']);
    if (!allowed.has(typeRaw)) {
      res.status(400).json({ error: 'Invalid media type' });
      return;
    }
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const result = await conversationService.listSharedMedia(
      paramId(req.params.id),
      req.userId!,
      {
        type: typeRaw as 'image' | 'video' | 'document' | 'link',
        cursor,
        limit: Number.isFinite(limit) ? limit : undefined,
      }
    );
    res.json(result);
  })
);

export default router;
