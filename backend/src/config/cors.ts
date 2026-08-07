import { config } from './index';

export function parseCorsOrigins(): string | string[] {
  const raw = config.socketCorsOrigin;

  if (!raw) {
    if (config.isProduction) {
      throw new Error(
        'Missing SOCKET_CORS_ORIGIN (or CORS_ORIGIN / CLIENT_URL) in production'
      );
    }
    return '*';
  }

  if (raw === '*') return '*';

  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
}

export function isOriginAllowed(origin: string | undefined, allowed: string | string[]): boolean {
  if (!origin) return true;
  if (allowed === '*') return true;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(origin);
}
