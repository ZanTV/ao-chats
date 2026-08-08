import { BorderRadius, Spacing } from './index';

/**
 * Shared message composer layout tokens — single source for sizing.
 * Keep values moderate: premium through proportion, not decoration.
 */
export const ComposerLayout = {
  /** Collapsed single-line field height (text area). */
  minHeight: 22,
  /** Stop expanding; scroll internally beyond this. */
  maxHeight: 132,
  /** Outer control row min height. */
  rowMinHeight: 44,
  iconSize: 22,
  sendIconSize: 18,
  controlSize: 36,
  fieldRadius: BorderRadius.lg,
  fieldPaddingH: Spacing.sm,
  fieldPaddingV: 8,
  gap: 6,
} as const;
