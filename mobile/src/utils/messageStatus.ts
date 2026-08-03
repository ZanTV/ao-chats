import { ChatMessage } from './messages';

export type AoDisplayStatus = 'sending' | 'sent' | 'waiting' | 'delivered' | 'read' | 'failed';

export function getAoMessageStatus(
  message: ChatMessage,
  isOwn: boolean
): AoDisplayStatus | null {
  if (!isOwn) return null;
  if (message.failed) return 'failed';
  if (message.pending) return 'sending';
  if (message.readAt || message.status === 'READ') return 'read';
  if (message.deliveredAt || message.status === 'DELIVERED') return 'delivered';
  if (message.status === 'WAITING' || message.waitingAt) return 'waiting';
  return 'sent';
}

export function applyStatusUpdate(
  message: ChatMessage,
  payload: {
    status?: string;
    deliveredAt?: string;
    readAt?: string;
    waitingAt?: string | null;
  }
): ChatMessage {
  const next = { ...message };
  if (payload.status) next.status = payload.status as ChatMessage['status'];
  if (payload.deliveredAt) next.deliveredAt = payload.deliveredAt;
  if (payload.readAt) next.readAt = payload.readAt;
  if (payload.waitingAt !== undefined) {
    next.waitingAt = payload.waitingAt ?? undefined;
  }
  if (payload.status === 'DELIVERED' && !next.deliveredAt) {
    next.deliveredAt = new Date().toISOString();
  }
  if (payload.status === 'READ' && !next.readAt) {
    next.readAt = new Date().toISOString();
  }
  return next;
}
