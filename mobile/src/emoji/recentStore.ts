import { create } from 'zustand';
import { getSetting, setSetting } from '../services/storage';
import { AO_EMOJI_CONFIG } from './config';
import type { AoEmojiItem, AoEmojiType, AoRecentEntry } from './types';

function rankScore(entry: AoRecentEntry, now: number): number {
  const age = Math.max(0, now - entry.lastUsedAt);
  const recency = Math.exp(-age / AO_EMOJI_CONFIG.RECENCY_HALF_LIFE_MS);
  return (
    entry.usageCount * AO_EMOJI_CONFIG.USAGE_WEIGHT +
    recency * AO_EMOJI_CONFIG.RECENCY_WEIGHT
  );
}

function sortRecent(entries: AoRecentEntry[]): AoRecentEntry[] {
  const now = Date.now();
  return [...entries].sort((a, b) => rankScore(b, now) - rankScore(a, now));
}

interface RecentState {
  entries: AoRecentEntry[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordUse: (item: Pick<AoEmojiItem, 'id' | 'char' | 'type'>) => void;
  ranked: () => AoRecentEntry[];
}

export const useAoEmojiRecentStore = create<RecentState>((set, get) => ({
  entries: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const saved = await getSetting<AoRecentEntry[]>(AO_EMOJI_CONFIG.RECENT_STORAGE_KEY, []);
    const cleaned = Array.isArray(saved)
      ? saved.filter(
          (e) =>
            e &&
            typeof e.id === 'string' &&
            typeof e.char === 'string' &&
            typeof e.usageCount === 'number' &&
            typeof e.lastUsedAt === 'number'
        )
      : [];
    set({ entries: sortRecent(cleaned).slice(0, AO_EMOJI_CONFIG.MAX_RECENT_EMOJIS), hydrated: true });
  },

  recordUse: (item) => {
    const now = Date.now();
    const prev = get().entries;
    const idx = prev.findIndex((e) => e.id === item.id);
    let next: AoRecentEntry[];

    if (idx >= 0) {
      const updated: AoRecentEntry = {
        ...prev[idx],
        usageCount: prev[idx].usageCount + 1,
        lastUsedAt: now,
        char: item.char,
        type: item.type,
      };
      next = [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
    } else {
      const created: AoRecentEntry = {
        id: item.id,
        char: item.char,
        type: (item.type || 'unicode') as AoEmojiType,
        usageCount: 1,
        lastUsedAt: now,
      };
      next = [created, ...prev];
    }

    next = sortRecent(next).slice(0, AO_EMOJI_CONFIG.MAX_RECENT_EMOJIS);
    set({ entries: next });
    void setSetting(AO_EMOJI_CONFIG.RECENT_STORAGE_KEY, next);
  },

  ranked: () => sortRecent(get().entries).slice(0, AO_EMOJI_CONFIG.MAX_RECENT_EMOJIS),
}));
