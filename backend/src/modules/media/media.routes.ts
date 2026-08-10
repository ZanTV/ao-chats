import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { prisma } from '../../config/database';
import type { MessageAttachment } from '../../utils/attachment';
import { isMessageAttachmentLike, normalizeAttachmentPayload } from '../../utils/attachment';
import { config } from '../../config';

const router = Router();

/**
 * Resolve attachment by id for authenticated participants only.
 * Never exposes private chat media without conversation membership.
 */
router.get(
  '/:attachmentId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const attachmentId = String(req.params.attachmentId || '').trim();
    if (!attachmentId) throw new AppError(400, 'Missing media id');

    const rows = await prisma.$queryRaw<
      Array<{
        messageId: string;
        conversationId: string;
        senderId: string;
        createdAt: Date;
        content: string;
        type: string;
        attachment: unknown;
        firstName: string;
        lastName: string;
        avatarId: string;
        avatarUrl: string | null;
        avatarVersion: number | null;
      }>
    >`
      SELECT
        m.id AS "messageId",
        m.conversation_id AS "conversationId",
        m.sender_id AS "senderId",
        m.created_at AS "createdAt",
        m.content AS content,
        m.type::text AS type,
        m.attachment AS attachment,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.avatar_id AS "avatarId",
        u.avatar_url AS "avatarUrl",
        u.avatar_version AS "avatarVersion"
      FROM messages m
      INNER JOIN participants p ON p.conversation_id = m.conversation_id
      INNER JOIN users u ON u.id = m.sender_id
      WHERE p.user_id = ${req.userId!}
        AND m.attachment IS NOT NULL
        AND (m.attachment->>'id') = ${attachmentId}
        AND m.deleted_for_all = false
        AND NOT (${req.userId!} = ANY (m.deleted_for))
      ORDER BY m.created_at DESC
      LIMIT 1
    `;

    const row = rows[0];
    if (!row || !isMessageAttachmentLike(row.attachment)) {
      throw new AppError(404, 'Media unavailable');
    }

    const attachment = normalizeAttachmentPayload(
      row.attachment,
      config.apiUrl
    ) as MessageAttachment;

    // Sibling media in same conversation (for swipe navigation) — capped
    const siblings = await prisma.$queryRaw<Array<{ attachment: unknown }>>`
      SELECT m.attachment AS attachment
      FROM messages m
      INNER JOIN participants p ON p.conversation_id = m.conversation_id
      WHERE p.user_id = ${req.userId!}
        AND m.conversation_id = ${row.conversationId}
        AND m.attachment IS NOT NULL
        AND m.type IN ('IMAGE', 'FILE')
        AND m.deleted_for_all = false
        AND NOT (${req.userId!} = ANY (m.deleted_for))
      ORDER BY m.created_at ASC
      LIMIT 80
    `;

    const gallery = siblings
      .map((s) => normalizeAttachmentPayload(s.attachment, config.apiUrl))
      .filter((a): a is MessageAttachment => a !== null);

    res.json({
      media: {
        attachment,
        messageId: row.messageId,
        conversationId: row.conversationId,
        content: row.content,
        type: row.type,
        createdAt: row.createdAt,
        sender: {
          id: row.senderId,
          firstName: row.firstName,
          lastName: row.lastName,
          avatarId: row.avatarId,
          avatarUrl: row.avatarUrl,
          avatarVersion: row.avatarVersion ?? 0,
        },
      },
      gallery,
    });
  })
);

export default router;
