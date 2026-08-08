import { getSocketUrl, isProduction } from './config';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wake Render free-tier / retry after brief 502. Returns true when API responds. */
export async function warmupApi(maxAttempts = isProduction() ? 5 : 2): Promise<boolean> {
  const base = getSocketUrl();
  const url = `${base}/health/live`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      // retry
    }
    if (attempt < maxAttempts - 1) {
      await sleep(1200 * (attempt + 1));
    }
  }
  return false;
}
