import type { CacheDomainKey, CacheEnvelope, VersionedFetchResult } from './types';
import { mmkvGet, mmkvSet, mmkvDelete, mmkvClearPrefix, mmkvClearAll } from './mmkvStore';
import {
  sqliteGetLatestMessages,
  sqliteUpsertMessages,
  sqliteDeleteConversation,
  sqliteClearAll,
} from './messageDb';
import type { ChatMessage } from '../utils/messages';
import { dedupeMessages } from '../utils/messages';

function resolveKey(domainOrKey: string, id?: string): string {
  if (id) return `cache:${domainOrKey}:${id}`;
  if (domainOrKey.startsWith('cache:')) return domainOrKey;
  return `cache:${domainOrKey}`;
}

function safeParse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class CacheManager {
  /** Read versioned envelope from MMKV */
  get<T>(domain: CacheDomainKey | string, id?: string): CacheEnvelope<T> | null {
    const raw = mmkvGet(resolveKey(domain, id));
    return safeParse<CacheEnvelope<T>>(raw);
  }

  set<T>(domain: CacheDomainKey | string, data: T, version?: number, id?: string): void {
    const envelope: CacheEnvelope<T> = {
      version: version ?? Date.now(),
      updatedAt: new Date().toISOString(),
      data,
    };
    mmkvSet(resolveKey(domain, id), JSON.stringify(envelope));
  }

  remove(domain: CacheDomainKey | string, id?: string): void {
    mmkvDelete(resolveKey(domain, id));
  }

  /**
   * Local-first loading: render cached data immediately, then refresh from network.
   * Updates local cache when server version differs.
   */
  async loadWithRefresh<T>(
    domain: CacheDomainKey | string,
    fetcher: () => Promise<VersionedFetchResult<T>>,
    onUpdate?: (data: T) => void,
    id?: string
  ): Promise<T | null> {
    const cached = this.get<T>(domain, id);
    if (cached?.data !== undefined && cached.data !== null) {
      onUpdate?.(cached.data);
    }

    try {
      const remote = await fetcher();
      const remoteVersion = remote.cacheVersion ?? Date.now();
      const localVersion = cached?.version ?? 0;

      if (!cached || remoteVersion !== localVersion) {
        this.set(domain, remote.data, remoteVersion, id);
        onUpdate?.(remote.data);
      }
      return remote.data;
    } catch {
      return cached?.data ?? null;
    }
  }

  // ── Messages (SQLite) ──────────────────────────────────────────────

  async getLocalMessages(conversationId: string): Promise<ChatMessage[]> {
    return sqliteGetLatestMessages(conversationId, 500);
  }

  async saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;
    await sqliteUpsertMessages(conversationId, dedupeMessages(messages));
  }

  async mergeMessages(conversationId: string, messages: ChatMessage[]): Promise<ChatMessage[]> {
    await this.saveMessages(conversationId, messages);
    return this.getLocalMessages(conversationId);
  }

  async appendMessage(conversationId: string, message: ChatMessage): Promise<void> {
    await sqliteUpsertMessages(conversationId, [message]);
  }

  async clearConversationMessages(conversationId: string): Promise<void> {
    await sqliteDeleteConversation(conversationId);
  }

  async clearAllMessages(): Promise<void> {
    await sqliteClearAll();
  }

  // ── Search history ─────────────────────────────────────────────────

  getSearchHistory(): string[] {
    return this.get<string[]>('search_history')?.data ?? [];
  }

  addSearchQuery(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    const current = this.getSearchHistory().filter((q) => q !== trimmed);
    const next = [trimmed, ...current].slice(0, 20);
    this.set('search_history', next);
  }

  clearSearchHistory(): void {
    this.remove('search_history');
  }

  // ── Bulk clear (logout) ────────────────────────────────────────────

  clearUserCache(): void {
    mmkvClearPrefix('cache:').catch(() => {});
    sqliteClearAll().catch(() => {});
  }

  async clearUserCacheAsync(): Promise<void> {
    await mmkvClearAll();
    await sqliteClearAll();
  }
}

export const cacheManager = new CacheManager();

/** @deprecated Use cacheManager — kept for gradual migration */
export async function cacheData(key: string, data: unknown): Promise<void> {
  cacheManager.set(key, data);
}

/** @deprecated Use cacheManager — kept for gradual migration */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const env = cacheManager.get<T>(key);
  return env?.data ?? null;
}

export async function clearCache(): Promise<void> {
  await cacheManager.clearUserCacheAsync();
}
