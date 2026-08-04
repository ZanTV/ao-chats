/** Shared reply/pin preview text for media, deleted, and text messages. */

export type ReplyLike = {
  content?: string;
  type?: string;
  deletedForAll?: boolean;
  isDeleted?: boolean;
};

export function getReplyPreviewText(
  reply: ReplyLike | null | undefined,
  deletedLabel = 'This message was deleted'
): string {
  if (!reply) return 'Message';
  if (reply.deletedForAll || reply.isDeleted) return deletedLabel;
  const type = String(reply.type || 'TEXT').toUpperCase();
  if (type === 'IMAGE') return '📷 Photo';
  if (type === 'VIDEO') return '🎥 Video';
  if (type === 'FILE') return '📎 Document';
  if (type === 'SYSTEM') return reply.content || 'System';
  return (reply.content || '').trim() || 'Message';
}

export function getReplyMediaIcon(type?: string): 'image-outline' | 'videocam-outline' | 'document-outline' | 'chatbubble-outline' {
  const t = String(type || 'TEXT').toUpperCase();
  if (t === 'IMAGE') return 'image-outline';
  if (t === 'VIDEO') return 'videocam-outline';
  if (t === 'FILE') return 'document-outline';
  return 'chatbubble-outline';
}
