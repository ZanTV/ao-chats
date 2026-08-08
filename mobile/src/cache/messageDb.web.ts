import type { ChatMessage } from '../utils/messages';

const webMessages = new Map<string, ChatMessage[]>();

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function upsertWebMessages(conversationId: string, messages: ChatMessage[]): void {
  const existing = webMessages.get(conversationId) ?? [];
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const msg of messages) {
    map.set(msg.id, msg);
  }
  webMessages.set(conversationId, sortMessages(Array.from(map.values())));
}

export async function sqliteGetMessages(
  conversationId: string,
  limit?: number
): Promise<ChatMessage[]> {
  const list = webMessages.get(conversationId) ?? [];
  return limit ? list.slice(-limit) : list;
}

export async function sqliteGetLatestMessages(
  conversationId: string,
  limit: number
): Promise<ChatMessage[]> {
  const list = webMessages.get(conversationId) ?? [];
  return list.slice(-limit);
}

export async function sqliteUpsertMessages(
  conversationId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  upsertWebMessages(conversationId, messages);
}

export async function sqliteDeleteMessages(
  conversationId: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  const existing = webMessages.get(conversationId);
  if (!existing) return;
  const remove = new Set(messageIds);
  webMessages.set(
    conversationId,
    existing.filter((m) => !remove.has(m.id))
  );
}

export async function sqliteDeleteConversation(conversationId: string): Promise<void> {
  webMessages.delete(conversationId);
}

export async function sqliteMessageCount(conversationId: string): Promise<number> {
  return webMessages.get(conversationId)?.length ?? 0;
}

export async function sqliteClearAll(): Promise<void> {
  webMessages.clear();
}
