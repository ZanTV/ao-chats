/**
 * Shared message composer layout tokens — single source for sizing.
 * Keep values moderate: premium through proportion, not decoration.
 * Do NOT import from ./index (circular) — that can blank the web bundle.
 */
export const ComposerLayout = {
  /** Collapsed single-line field height (text area). */
  minHeight: 22,
  /** Stop expanding; scroll internally after this. */
  maxHeight: 132,
  /** Outer control row min height. */
  rowMinHeight: 44,
  iconSize: 22,
  sendIconSize: 18,
  controlSize: 36,
  /** Matches BorderRadius.lg */
  fieldRadius: 16,
  /** Matches Spacing.sm */
  fieldPaddingH: 8,
  fieldPaddingV: 8,
  gap: 6,
} as const;
