/** Shared reply/pin preview text for media, deleted, and text messages. */

export type ReplyAttachmentLike = {
  kind?: string;
  mimeType?: string;
  fileName?: string;
  duration?: number;
};

export type ReplyLike = {
  content?: string;
  type?: string;
  deletedForAll?: boolean;
  isDeleted?: boolean;
  attachment?: ReplyAttachmentLike | null;
};

function resolveMediaKind(reply: ReplyLike): 'image' | 'video' | 'document' | null {
  const att = reply.attachment;
  if (att?.kind === 'image' || att?.kind === 'video' || att?.kind === 'document') {
    return att.kind;
  }
  const mime = String(att?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (att?.mimeType || att?.fileName) return 'document';

  const type = String(reply.type || 'TEXT').toUpperCase();
  if (type === 'IMAGE') return 'image';
  if (type === 'VIDEO') return 'video';
  if (type === 'FILE') return 'document';
  return null;
}

function formatDuration(seconds?: number): string {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return '';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function getReplyPreviewText(
  reply: ReplyLike | null | undefined,
  deletedLabel = 'This message was deleted'
): string {
  if (!reply) return 'Message';
  if (reply.deletedForAll || reply.isDeleted) return deletedLabel;

  const kind = resolveMediaKind(reply);
  if (kind === 'image') return '📷 Photo';
  if (kind === 'video') {
    const dur = formatDuration(reply.attachment?.duration);
    return dur ? `🎥 Video · ${dur}` : '🎥 Video';
  }
  if (kind === 'document') {
    const name = reply.attachment?.fileName?.trim();
    return name ? `📎 ${name}` : '📎 Document';
  }

  const type = String(reply.type || 'TEXT').toUpperCase();
  if (type === 'SYSTEM') return reply.content || 'System';
  return (reply.content || '').trim() || 'Message';
}

export function getReplyMediaIcon(
  replyOrType?: ReplyLike | string | null
): 'image-outline' | 'videocam-outline' | 'document-outline' | 'chatbubble-outline' {
  if (!replyOrType) return 'chatbubble-outline';
  if (typeof replyOrType === 'string') {
    const t = replyOrType.toUpperCase();
    if (t === 'IMAGE') return 'image-outline';
    if (t === 'VIDEO') return 'videocam-outline';
    if (t === 'FILE') return 'document-outline';
    return 'chatbubble-outline';
  }
  const kind = resolveMediaKind(replyOrType);
  if (kind === 'image') return 'image-outline';
  if (kind === 'video') return 'videocam-outline';
  if (kind === 'document') return 'document-outline';
  return 'chatbubble-outline';
}
