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
  },
  currentUserId: string,
  senderName?: string
): string {
  const prefix = message.senderId === currentUserId ? 'You' : (senderName || 'Someone');

  if (message.deletedForAll || message.isDeleted) {
    return '';
  }

  switch (message.type) {
    case 'IMAGE':
      return `${prefix}: 📷 Photo`;
    case 'FILE':
      return `${prefix}: 📄 Document`;
    case 'SYSTEM':
      return message.content;
    default:
      return `${prefix}: ${message.content}`;
  }
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
