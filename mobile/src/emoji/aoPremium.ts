import type { AoEmojiItem } from './types';

/**
 * AO Premium emoji — separate from Unicode catalog.
 * Architecture supports lock/membership later; MVP leaves unlocked.
 */
export const AO_PREMIUM_EMOJIS: AoEmojiItem[] = [
  {
    id: 'ao_wave',
    char: '👋',
    name: 'AO Wave',
    keywords: ['ao', 'wave', 'hello', 'ao wave', 'ao chats'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_fire',
    char: '🔥',
    name: 'AO Fire',
    keywords: ['ao', 'fire', 'lit', 'ao fire', 'hype'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_heart',
    char: '💙',
    name: 'AO Heart',
    keywords: ['ao', 'heart', 'love', 'ao heart', 'blue'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_star',
    char: '⭐',
    name: 'AO Star',
    keywords: ['ao', 'star', 'favorite', 'ao star'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_grad',
    char: '🎓',
    name: 'AO Graduate',
    keywords: ['ao', 'graduate', 'graduation', 'university', 'campus', 'degree'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_books',
    char: '📚',
    name: 'AO Books',
    keywords: ['ao', 'books', 'study', 'library', 'exam', 'university'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_rocket',
    char: '🚀',
    name: 'AO Rocket',
    keywords: ['ao', 'rocket', 'launch', 'ambition', 'ao rocket'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_spark',
    char: '✨',
    name: 'AO Spark',
    keywords: ['ao', 'spark', 'sparkle', 'magic', 'premium'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_chat',
    char: '💬',
    name: 'AO Chat',
    keywords: ['ao', 'chat', 'message', 'ao chats', 'talk'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_trophy',
    char: '🏆',
    name: 'AO Trophy',
    keywords: ['ao', 'trophy', 'win', 'champion', 'success'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_coffee',
    char: '☕',
    name: 'AO Coffee',
    keywords: ['ao', 'coffee', 'study', 'cafe', 'break'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
  {
    id: 'ao_tz',
    char: '🇹🇿',
    name: 'AO Tanzania',
    keywords: ['ao', 'tanzania', 'tz', 'flag', 'home'],
    categoryId: 'ao_premium',
    type: 'ao_premium',
    premium: true,
    locked: false,
  },
];

export function getAoPremiumEmojis(): AoEmojiItem[] {
  return AO_PREMIUM_EMOJIS;
}

export function getAoPremiumById(id: string): AoEmojiItem | undefined {
  return AO_PREMIUM_EMOJIS.find((e) => e.id === id);
}
