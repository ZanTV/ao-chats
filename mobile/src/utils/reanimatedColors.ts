/**
 * Reanimated worklet helpers for safe color/opacity animation.
 * Prevents invalid rgba() alpha strings (e.g. 8.15e-7) during withTiming decay.
 */

/** Clamp opacity to [0, 1] and snap near-zero values to 0. */
export function clampOpacity(value: number): number {
  'worklet';
  const clamped = Math.min(1, Math.max(0, value));
  if (clamped < 0.0001) return 0;
  return Math.round(clamped * 1000) / 1000;
}

/** Build rgba() with a clamped, non-scientific alpha (fallback when interpolateColor is unsuitable). */
export function safeRgba(r: number, g: number, b: number, alpha: number): string {
  'worklet';
  return `rgba(${r}, ${g}, ${b}, ${clampOpacity(alpha)})`;
}

/** Message jump-highlight fallbacks (theme may override via colors.jumpHighlight*) */
export const MESSAGE_HIGHLIGHT_FROM = 'rgba(245, 158, 11, 0)';
export const MESSAGE_HIGHLIGHT_TO = 'rgba(245, 158, 11, 0.34)';
export const MESSAGE_HIGHLIGHT_FROM_DARK = 'rgba(251, 191, 36, 0)';
export const MESSAGE_HIGHLIGHT_TO_DARK = 'rgba(251, 191, 36, 0.38)';
