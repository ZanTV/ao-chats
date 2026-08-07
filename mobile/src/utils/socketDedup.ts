type EventCallback = (...args: unknown[]) => void;

interface DedupeOptions {
  /** Drop duplicate events within this window (ms). Default 300. */
  windowMs?: number;
  /** Build a unique key from event args. Default JSON.stringify(args). */
  keyFn?: (...args: unknown[]) => string;
}

/**
 * Wraps a socket callback to ignore duplicate events fired within a short window.
 */
export function dedupeSocketHandler(
  handler: EventCallback,
  options: DedupeOptions = {}
): EventCallback {
  const windowMs = options.windowMs ?? 300;
  const keyFn = options.keyFn ?? ((...args) => JSON.stringify(args));
  const recent = new Map<string, number>();

  return (...args: unknown[]) => {
    const key = keyFn(...args);
    const now = Date.now();
    const last = recent.get(key);
    if (last !== undefined && now - last < windowMs) return;
    recent.set(key, now);

    // Prevent unbounded growth
    if (recent.size > 200) {
      const cutoff = now - windowMs * 2;
      for (const [k, ts] of recent) {
        if (ts < cutoff) recent.delete(k);
      }
    }

    handler(...args);
  };
}
