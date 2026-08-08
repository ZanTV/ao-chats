/** Dev-only startup/API timing — no secrets logged. */

const marks = new Map<string, number>();

export function perfMark(label: string): void {
  if (!__DEV__) return;
  marks.set(label, Date.now());
}

export function perfMeasure(label: string, startLabel: string): void {
  if (!__DEV__) return;
  const start = marks.get(startLabel);
  if (start === undefined) return;
  const ms = Date.now() - start;
  console.log(`[AO Perf] ${label}: ${ms}ms`);
}

export async function perfAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!__DEV__) return fn();
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[AO Perf] ${label}: ${Date.now() - start}ms`);
  }
}
