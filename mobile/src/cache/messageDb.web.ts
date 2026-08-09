/**
 * Web message cache — persisted so refresh does not lose attachment metadata
 * while the server remains source of truth after merge.
 */

import type { ChatMessage } from '../utils/messages';
import { mergeMessageFields } from '../utils/messageMerge';
import { mmkvGet, mmkvSet, mmkvDelete, mmkvGetAllKeys, hydrateLocalCache } from './mmkvStore';

const PREFIX = 'msgdb:';

const webMessages = new Map<string, ChatMessage[]>();
let mapped = false;

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function persist(conversationId: string, messages: ChatMessage[]) {
  mmkvSet(PREFIX + conversationId, JSON.stringify(messages));
}

async function ensureMapped() {
  await hydrateLocalCache();
  if (mapped) return;
  mapped = true;
  try {
    const keys = mmkvGetAllKeys(PREFIX);
    for (const key of keys) {
      const raw = mmkvGet(key);
      if (!raw) continue;
      try {
        const list = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(list)) {
          webMessages.set(key.slice(PREFIX.length), sortMessages(list));
        }
      } catch {
        // ignore corrupt entry
      }
    }
  } catch {
    // optional
  }
}

function upsertWebMessages(conversationId: string, messages: ChatMessage[]) {
  const existing = webMessages.get(conversationId) ?? [];
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const msg of messages) {
    const prev = map.get(msg.id);
    map.set(msg.id, prev ? mergeMessageFields(prev, msg) : msg);
  }
  const next = sortMessages(Array.from(map.values()));
  webMessages.set(conversationId, next);
  persist(conversationId, next.slice(-500));
}

export async function sqliteGetMessages(
  conversationId: string,
  limit?: number
): Promise<ChatMessage[]> {
  await ensureMapped();
  const list = webMessages.get(conversationId) ?? [];
  return limit ? list.slice(-limit) : list;
}

export async function sqliteGetLatestMessages(
  conversationId: string,
  limit: number
): Promise<ChatMessage[]> {
  await ensureMapped();
  const list = webMessages.get(conversationId) ?? [];
  return list.slice(-limit);
}

export async function sqliteUpsertMessages(
  conversationId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  await ensureMapped();
  upsertWebMessages(conversationId, messages);
}

export async function sqliteDeleteMessages(
  conversationId: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  await ensureMapped();
  const existing = webMessages.get(conversationId);
  if (!existing) return;
  const remove = new Set(messageIds);
  const next = existing.filter((m) => !remove.has(m.id));
  webMessages.set(conversationId, next);
  persist(conversationId, next);
}

export async function sqliteDeleteConversation(conversationId: string): Promise<void> {
  await ensureMapped();
  webMessages.delete(conversationId);
  mmkvDelete(PREFIX + conversationId);
}

export async function sqliteMessageCount(conversationId: string): Promise<number> {
  await ensureMapped();
  return webMessages.get(conversationId)?.length ?? 0;
}

export async function sqliteClearAll(): Promise<void> {
  await ensureMapped();
  const keys = mmkvGetAllKeys(PREFIX);
  for (const key of keys) mmkvDelete(key);
  webMessages.clear();
}
