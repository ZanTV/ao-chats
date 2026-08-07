interface SortableConversation {
  isPinned?: boolean;
  updatedAt: string;
}

export function sortConversations<T extends SortableConversation>(conversations: T[]): T[] {
  return [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function formatConversationTime(dateStr: string, locale?: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) {
    return date.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (date >= startOfYesterday) {
    return 'Yesterday';
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(locale || undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function getLastMessagePreview(
  lastMessage: {
    preview?: string;
    content: string;
    senderId: string;
    type?: string;
    senderName?: string;
  } | null,
  currentUserId: string,
  fallback: string
): string {
  if (!lastMessage) return fallback;
  if (lastMessage.preview) return lastMessage.preview;

  const prefix =
    lastMessage.senderId === currentUserId
      ? 'You'
      : lastMessage.senderName || 'Someone';

  switch (lastMessage.type) {
    case 'IMAGE':
      return `${prefix}: 📷 Photo`;
    case 'FILE':
      return `${prefix}: 📄 Document`;
    case 'SYSTEM':
      return lastMessage.content;
    default:
      return `${prefix}: ${lastMessage.content}`;
  }
}

export interface ConversationPreviewMeta {
  text: string;
  isDraft: boolean;
  isPending: boolean;
}

export function getConversationListPreview(
  lastMessage: {
    preview?: string;
    content: string;
    senderId: string;
    type?: string;
    senderName?: string;
  } | null,
  draft: string | undefined,
  pendingMessages: Array<{ content: string; pending?: boolean; failed?: boolean }> | undefined,
  currentUserId: string,
  labels: { you: string; draft: string; sending: string; failed: string; fallback: string }
): ConversationPreviewMeta {
  const pending = pendingMessages?.find((m) => m.pending || m.failed);
  if (pending) {
    const statusLabel = pending.failed ? labels.failed : labels.sending;
    return {
      text: `${labels.you}: ${statusLabel} ${pending.content}`,
      isDraft: false,
      isPending: true,
    };
  }

  if (draft?.trim()) {
    return {
      text: `${labels.draft}: ${draft.trim()}`,
      isDraft: true,
      isPending: false,
    };
  }

  return {
    text: getLastMessagePreview(lastMessage, currentUserId, labels.fallback),
    isDraft: false,
    isPending: false,
  };
}
