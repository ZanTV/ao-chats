import { config } from './index';

export function parseCorsOrigins(): string | string[] {
  const raw =
    process.env.SOCKET_CORS_ORIGIN ||
    process.env.CORS_ORIGIN ||
    process.env.CLIENT_URL;

  if (!raw) {
    if (config.nodeEnv === 'production') {
      return ['https://www.aochats.chat', 'https://aochats.chat'];
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
