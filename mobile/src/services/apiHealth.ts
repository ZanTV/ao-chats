import { getSocketUrl, isProduction } from './config';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wake Render / retry after brief 502. Non-blocking — run in background. */
export async function warmupApi(maxAttempts = isProduction() ? 2 : 1): Promise<boolean> {
  const base = getSocketUrl();
  const url = `${base}/health/live`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      // retry
    }
    if (attempt < maxAttempts - 1) {
      await sleep(800 * (attempt + 1));
    }
  }
  return false;
}
