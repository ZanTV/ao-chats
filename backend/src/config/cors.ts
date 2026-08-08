import { config } from './index';

/** Add apex ↔ www pair so CORS works for both aochats.chat and www.aochats.chat */
function expandOriginPairs(origins: string[]): string[] {
  const set = new Set(origins);

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      const host = url.hostname;

      if (host.startsWith('www.')) {
        set.add(`${url.protocol}//${host.slice(4)}`);
      } else if (host !== 'localhost' && !host.startsWith('127.')) {
        set.add(`${url.protocol}//www.${host}`);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return [...set];
}

export function parseCorsOrigins(): string | string[] {
  const raw = config.socketCorsOrigin;

  if (!raw) {
    if (config.isProduction) {
      console.error(
        '[AO Chats] Missing SOCKET_CORS_ORIGIN — using https://www.aochats.chat defaults'
      );
      return expandOriginPairs(['https://www.aochats.chat', 'https://aochats.chat']);
    }
    return '*';
  }

  if (raw === '*') return '*';

  const origins = expandOriginPairs(
    raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  );

  // Array mode reflects the request Origin — required when multiple frontends exist.
  return origins.length === 1 ? origins[0] : origins;
}

export function isOriginAllowed(origin: string | undefined, allowed: string | string[]): boolean {
  if (!origin) return true;
  if (allowed === '*') return true;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(origin);
}
