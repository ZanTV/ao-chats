import { MessageType } from '@prisma/client';

/** Canonical 1-to-1 pair key — order-independent (A:B === B:A). */
export function directConversationPairKey(userIdA: string, userIdB: string): string {
  return userIdA < userIdB ? `${userIdA}:${userIdB}` : `${userIdB}:${userIdA}`;
}

export function formatMessagePreview(
  message: {
    content: string;
    type: MessageType;
    senderId: string;
    isDeleted?: boolean;
    deletedForAll?: boolean;
    attachment?: unknown;
  },
  currentUserId: string,
  senderName?: string
): string {
  const prefix = message.senderId === currentUserId ? 'You' : (senderName || 'Someone');

  if (message.deletedForAll || message.isDeleted) {
    return '';
  }

  if (message.type === 'IMAGE') {
    return `${prefix}: 📷 Photo`;
  }

  if (message.type === 'FILE') {
    const att =
      message.attachment && typeof message.attachment === 'object'
        ? (message.attachment as { kind?: string; mimeType?: string })
        : null;
    const kind = String(att?.kind || '').toLowerCase();
    const mime = String(att?.mimeType || '').toLowerCase();
    if (kind === 'video' || mime.startsWith('video/')) {
      return `${prefix}: 🎥 Video`;
    }
    if (kind === 'image' || mime.startsWith('image/')) {
      return `${prefix}: 📷 Photo`;
    }
    return `${prefix}: 📄 Document`;
  }

  if (message.type === 'SYSTEM') {
    return message.content;
  }

  return `${prefix}: ${message.content}`;
}

export function sortConversations<T extends { isPinned?: boolean; updatedAt: string }>(
  conversations: T[]
): T[] {
  return [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
