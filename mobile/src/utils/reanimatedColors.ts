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

/** Message jump-highlight: blue overlay 0 → 22% opacity */
export const MESSAGE_HIGHLIGHT_FROM = 'rgba(37, 99, 235, 0)';
export const MESSAGE_HIGHLIGHT_TO = 'rgba(37, 99, 235, 0.22)';
