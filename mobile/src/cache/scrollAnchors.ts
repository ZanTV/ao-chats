/**
 * Per-conversation scroll anchor — local only, not server state.
 */

import { getSetting, setSetting } from '../services/storage';

export type ConversationScrollAnchor = {
  conversationId: string;
  messageId: string;
  nearBottom: boolean;
  updatedAt: string;
};

const KEY = 'chat_scroll_anchors_v1';

type AnchorMap = Record<string, ConversationScrollAnchor>;

async function readAll(): Promise<AnchorMap> {
  return (await getSetting<AnchorMap>(KEY, {})) || {};
}

export async function saveConversationScrollAnchor(
  conversationId: string,
  anchor: Omit<ConversationScrollAnchor, 'conversationId' | 'updatedAt'>
): Promise<void> {
  if (!conversationId || !anchor.messageId) return;
  const all = await readAll();
  all[conversationId] = {
    conversationId,
    messageId: anchor.messageId,
    nearBottom: Boolean(anchor.nearBottom),
    updatedAt: new Date().toISOString(),
  };
  await setSetting(KEY, all);
}

export async function getConversationScrollAnchor(
  conversationId: string
): Promise<ConversationScrollAnchor | null> {
  if (!conversationId) return null;
  const all = await readAll();
  return all[conversationId] || null;
}
