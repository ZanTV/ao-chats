/**
 * Legacy re-export — prefer `src/emoji` (AO Emoji System).
 */
export type { AoEmojiCategory as EmojiCategory } from '../emoji';
export {
  AO_EMOJI_CATEGORIES as EMOJI_CATEGORIES,
  searchAoEmojis,
} from '../emoji';

import { searchAoEmojis } from '../emoji';

/** @deprecated Use searchAoEmojis */
export function searchEmojis(query: string): { category: string; emoji: string }[] {
  return searchAoEmojis(query).map((item) => ({
    category: item.categoryId,
    emoji: item.char,
  }));
}
