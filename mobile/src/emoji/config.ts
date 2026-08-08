/** AO Emoji System — shared config (single source of truth). */
export const AO_EMOJI_CONFIG = {
  /** Max items in Recent (usage-ranked). */
  MAX_RECENT_EMOJIS: 24,
  /** Preference key via getSetting/setSetting. */
  RECENT_STORAGE_KEY: 'ao_emoji_recent_v1',
  /** Composer inline panel height (keyboard-like). */
  PICKER_PANEL_HEIGHT: 292,
  /** Ranking: frequency vs recency. */
  USAGE_WEIGHT: 1,
  RECENCY_WEIGHT: 12,
  /** Half-life for recency boost (ms). */
  RECENCY_HALF_LIFE_MS: 7 * 24 * 60 * 60 * 1000,
  /** Touch target for emoji cells. */
  EMOJI_CELL_MIN: 44,
} as const;
