import type { ChatMessage } from './messages';
import { isMessageAttachment, type MessageAttachment } from '../attachments/types';
import { resolveAttachmentUrl } from '../attachments/storage';

/** Merge message fields without letting missing remote attachment wipe a known local one. */
export function mergeMessageFields(existing: ChatMessage, incoming: ChatMessage): ChatMessage {
  const attachment =
    incoming.attachment && isMessageAttachment(incoming.attachment)
      ? incoming.attachment
      : existing.attachment && isMessageAttachment(existing.attachment)
        ? existing.attachment
        : incoming.attachment ?? existing.attachment ?? undefined;

  return {
    ...existing,
    ...incoming,
    attachment: attachment ?? undefined,
    pending: incoming.pending ?? existing.pending,
    failed: incoming.failed ?? existing.failed,
    reactions:
      Array.isArray(incoming.reactions) && incoming.reactions.length > 0
        ? incoming.reactions
        : existing.reactions,
    replyTo: incoming.replyTo ?? existing.replyTo,
    status: incoming.status ?? existing.status,
    readAt: incoming.readAt ?? existing.readAt,
    deliveredAt: incoming.deliveredAt ?? existing.deliveredAt,
    waitingAt: incoming.waitingAt ?? existing.waitingAt,
    isStarred: incoming.isStarred || existing.isStarred,
    isEdited: incoming.isEdited ?? existing.isEdited,
    editedAt: incoming.editedAt ?? existing.editedAt,
  };
}

/** Rebuild authenticated download URL when metadata exists but url was omitted. */
export function coerceAttachment(raw: unknown): MessageAttachment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as Partial<MessageAttachment> & { storageKey?: string };
  if (!a.id || !a.storageKey || !a.fileName || !a.mimeType) return undefined;

  const url = resolveAttachmentUrl({ storageKey: a.storageKey!, url: a.url ?? '' });

  const kind =
    a.kind === 'image' || a.kind === 'video' || a.kind === 'document'
      ? a.kind
      : a.mimeType.startsWith('image/')
        ? 'image'
        : a.mimeType.startsWith('video/')
          ? 'video'
          : 'document';

  return {
    id: a.id,
    kind,
    mimeType: a.mimeType,
    fileName: a.fileName,
    fileSize: typeof a.fileSize === 'number' ? a.fileSize : 0,
    storageKey: a.storageKey,
    url,
    width: a.width,
    height: a.height,
    duration: a.duration,
  };
}
