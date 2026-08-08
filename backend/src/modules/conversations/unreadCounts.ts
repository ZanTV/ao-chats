import { prisma } from '../../config/database';

/** Single query for all per-conversation unread counts (replaces N+1 message.count loops). */
export async function fetchUnreadCountsByConversation(
  userId: string
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ conversation_id: string; count: bigint }>>`
    SELECT m.conversation_id, COUNT(*)::bigint AS count
    FROM messages m
    INNER JOIN participants p
      ON p.conversation_id = m.conversation_id AND p.user_id = ${userId}
    WHERE m.sender_id <> ${userId}
      AND m.deleted_for_all = false
      AND NOT (${userId} = ANY(m.deleted_for))
      AND m.created_at > COALESCE(
        CASE
          WHEN p.cleared_at IS NOT NULL AND p.last_read_at IS NOT NULL
          THEN GREATEST(p.cleared_at, p.last_read_at)
          ELSE COALESCE(p.cleared_at, p.last_read_at, TIMESTAMP '1970-01-01')
        END,
        TIMESTAMP '1970-01-01'
      )
    GROUP BY m.conversation_id
  `;

  return new Map(rows.map((row) => [row.conversation_id, Number(row.count)]));
}

/** Authoritative unread count for one user in one conversation (for socket payloads). */
export async function fetchUnreadCountForConversation(
  conversationId: string,
  userId: string
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM messages m
    INNER JOIN participants p
      ON p.conversation_id = m.conversation_id AND p.user_id = ${userId}
    WHERE m.conversation_id = ${conversationId}
      AND m.sender_id <> ${userId}
      AND m.deleted_for_all = false
      AND NOT (${userId} = ANY(m.deleted_for))
      AND m.created_at > COALESCE(
        CASE
          WHEN p.cleared_at IS NOT NULL AND p.last_read_at IS NOT NULL
          THEN GREATEST(p.cleared_at, p.last_read_at)
          ELSE COALESCE(p.cleared_at, p.last_read_at, TIMESTAMP '1970-01-01')
        END,
        TIMESTAMP '1970-01-01'
      )
  `;

  return Number(rows[0]?.count ?? 0);
}
