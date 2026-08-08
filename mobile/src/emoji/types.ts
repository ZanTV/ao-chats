export type AoEmojiType = 'unicode' | 'ao_premium';

export interface AoEmojiItem {
  /** Stable id — unicode uses the character; premium uses ao_* ids. */
  id: string;
  /** Insert / react payload (unicode char or premium token). */
  char: string;
  name: string;
  keywords: string[];
  categoryId: string;
  type: AoEmojiType;
  premium?: boolean;
  /** Future membership gate — MVP keeps unlocked. */
  locked?: boolean;
  /** Optional asset for custom premium glyphs. */
  asset?: number | string;
}

export interface AoEmojiCategory {
  id: string;
  label: string;
  /** Category tab glyph / icon hint */
  icon: string;
  /** Hide from category strip when empty (e.g. recent). */
  dynamic?: boolean;
}

export interface AoRecentEntry {
  id: string;
  char: string;
  type: AoEmojiType;
  usageCount: number;
  lastUsedAt: number;
}

export type AoEmojiPickerPresentation = 'sheet' | 'panel';
