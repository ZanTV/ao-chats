import { getAoPremiumEmojis } from './aoPremium';
import { getUnicodeEmojis } from './unicodeCatalog';
import type { AoEmojiItem } from './types';

let _searchIndex: { item: AoEmojiItem; haystack: string }[] | null = null;

function buildIndex() {
  const all = [...getUnicodeEmojis(), ...getAoPremiumEmojis()];
  _searchIndex = all.map((item) => ({
    item,
    haystack: [item.name, ...item.keywords, item.id].join(' ').toLowerCase(),
  }));
}

/** Local, instant emoji search — global/official names & keywords only. */
export function searchAoEmojis(query: string): AoEmojiItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (!_searchIndex) buildIndex();

  const tokens = q.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const results: AoEmojiItem[] = [];

  for (const entry of _searchIndex!) {
    const ok = tokens.every((t) => entry.haystack.includes(t));
    if (!ok) continue;
    if (seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    results.push(entry.item);
  }

  return results;
}

export function getAllAoEmojis(): AoEmojiItem[] {
  return [...getUnicodeEmojis(), ...getAoPremiumEmojis()];
}

/** Warm the in-memory catalog/search index (call once on first picker open). */
export function warmAoEmojiCache(): void {
  getUnicodeEmojis();
  getAoPremiumEmojis();
  if (!_searchIndex) buildIndex();
}
