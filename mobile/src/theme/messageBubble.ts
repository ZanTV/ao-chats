/**
 * Shared message bubble width tokens — reply sizing reuses these constraints.
 */
export const MessageBubbleLayout = {
  /** Max share of chat row for any bubble. */
  maxWidthPercent: '84%' as const,
  /**
   * Min width when a message includes a reply quote.
   * Prevents short replies ("ok", emoji) from collapsing the quote preview.
   * Still content-aware below max — not forced full width.
   */
  replyMinWidthPercent: '56%' as const,
} as const;
