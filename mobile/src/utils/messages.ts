export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  type: string;
  replyToId?: string;
  replyTo?: {
    id: string;
    content: string;
    type?: string;
    deletedForAll?: boolean;
    isDeleted?: boolean;
    senderId?: string;
    sender: { firstName: string };
  };
  reactions: Array<{ emoji: string; userId: string; user: { firstName: string } }>;
  readAt?: string;
  deliveredAt?: string;
  waitingAt?: string;
  status?: 'SENT' | 'WAITING' | 'DELIVERED' | 'READ';
  createdAt: string;
  isDeleted?: boolean;
  deletedForAll?: boolean;
  isForwarded?: boolean;
  forwardedFromId?: string;
  isStarred?: boolean;
  pending?: boolean;
  failed?: boolean;
  isEdited?: boolean;
  editedAt?: string;
}

/** Remove duplicate messages by id — keeps the last occurrence */
export function dedupeMessages<T extends { id: string }>(list: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of list) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function isSameMessage(a: ChatMessage, b: ChatMessage): boolean {
  return (
    a.senderId === b.senderId &&
    a.content === b.content &&
    Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < 15000
  );
}

/** Merge local cache, remote fetch, and pending sends without duplicates */
export function mergeMessagesForLoad(...lists: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const list of lists) {
    for (const msg of list) {
      const existing = byId.get(msg.id);
      if (existing) {
        byId.set(msg.id, {
          ...existing,
          ...msg,
          pending: msg.pending ?? existing.pending,
          failed: msg.failed ?? existing.failed,
        });
      } else {
        byId.set(msg.id, msg);
      }
    }
  }

  let merged = Array.from(byId.values());

  merged = merged.filter((msg) => {
    if (!msg.pending && !msg.id.startsWith('temp-')) return true;
    const confirmed = merged.some(
      (other) =>
        other.id !== msg.id &&
        !other.pending &&
        !other.id.startsWith('temp-') &&
        isSameMessage(msg, other)
    );
    return !confirmed;
  });

  return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Insert or update a message without duplication.
 * Handles optimistic temp IDs and race between REST + Socket.IO.
 */
export function upsertMessage(
  list: ChatMessage[],
  incoming: ChatMessage,
  tempId?: string
): ChatMessage[] {
  const merged: ChatMessage = { ...incoming, pending: false, failed: false };

  let next = list.filter((m) => m.id !== tempId);

  next = next.filter((m) => {
    if (m.id === merged.id) return false;
    if (
      m.senderId === merged.senderId &&
      m.content === merged.content &&
      Math.abs(new Date(m.createdAt).getTime() - new Date(merged.createdAt).getTime()) < 8000
    ) {
      return m.pending || m.id.startsWith('temp-');
    }
    return true;
  });

  next = next.filter(
    (m) =>
      !(
        m.pending &&
        m.id.startsWith('temp-') &&
        m.senderId === merged.senderId &&
        m.content === merged.content
      )
  );

  const idx = next.findIndex((m) => m.id === merged.id);
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...merged };
    return dedupeMessages(next);
  }

  return dedupeMessages([...next, merged]);
}

export function normalizeMessage(raw: Record<string, unknown>): ChatMessage {
  const stars = raw.stars as Array<{ id: string }> | undefined;
  return {
    id: String(raw.id),
    content: String(raw.content ?? ''),
    senderId: String(raw.senderId),
    type: String(raw.type ?? 'TEXT'),
    replyToId: raw.replyToId as string | undefined,
    replyTo: raw.replyTo as ChatMessage['replyTo'],
    reactions: (raw.reactions as ChatMessage['reactions']) || [],
    readAt: raw.readAt ? String(raw.readAt) : undefined,
    deliveredAt: raw.deliveredAt ? String(raw.deliveredAt) : undefined,
    waitingAt: raw.waitingAt ? String(raw.waitingAt) : undefined,
    status: raw.status as ChatMessage['status'],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    isDeleted: Boolean(raw.isDeleted),
    deletedForAll: Boolean(raw.deletedForAll),
    isForwarded: Boolean(raw.isForwarded),
    forwardedFromId: raw.forwardedFromId as string | undefined,
    isStarred: Boolean(raw.isStarred) || (stars?.length ?? 0) > 0,
    pending: Boolean(raw.pending),
    failed: Boolean(raw.failed),
    isEdited: Boolean(raw.isEdited),
    editedAt: raw.editedAt ? String(raw.editedAt) : undefined,
  };
}
