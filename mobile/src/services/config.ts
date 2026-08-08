/**
 * Centralized environment configuration for AO Chats mobile.
 * Production reads EXPO_PUBLIC_* only — no hardcoded production URLs.
 */

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

/** Public production defaults — used only when EXPO_PUBLIC_* is missing from the build. */
const PRODUCTION_URL_DEFAULTS = {
  EXPO_PUBLIC_API_URL: 'https://api.aochats.chat/api',
  EXPO_PUBLIC_SOCKET_URL: 'https://api.aochats.chat',
  EXPO_PUBLIC_APP_URL: 'https://www.aochats.chat',
  EXPO_PUBLIC_STORAGE_URL: 'https://www.aochats.chat',
} as const;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function missingEnv(name: string): never {
  throw new Error(
    `Missing required environment variable: ${name}. ` +
      'Set it in mobile/.env.development (dev) or EAS/Vercel dashboard (production).'
  );
}

function readExtraEnv(key: 'apiUrl' | 'socketUrl' | 'appUrl' | 'storageUrl' | 'env'): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const value = Constants.expoConfig?.extra?.[key] as string | undefined;
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function resolvePublicEnv(
  envKey: keyof typeof PRODUCTION_URL_DEFAULTS,
  extraKey: 'apiUrl' | 'socketUrl' | 'appUrl' | 'storageUrl'
): string {
  const fromProcess = process.env[envKey]?.trim();
  if (fromProcess) {
    if (LOCALHOST_PATTERN.test(fromProcess)) {
      throw new Error(`${envKey} must not use localhost in production (got: ${fromProcess})`);
    }
    return stripTrailingSlash(fromProcess);
  }

  const fromExtra = readExtraEnv(extraKey);
  if (fromExtra) {
    if (LOCALHOST_PATTERN.test(fromExtra)) {
      throw new Error(`${envKey} must not use localhost in production (got: ${fromExtra})`);
    }
    return stripTrailingSlash(fromExtra);
  }

  const fallback = PRODUCTION_URL_DEFAULTS[envKey];
  if (isProduction() && fallback) {
    return fallback;
  }

  missingEnv(envKey);
}

function getDevApiUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const hostUri = Constants.expoConfig?.hostUri as string | undefined;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && !LOCALHOST_PATTERN.test(host)) {
        return `http://${host}:3001/api`;
      }
    }
  } catch {
    // fall through
  }
  return 'http://localhost:3001/api';
}

function getDevSocketUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const hostUri = Constants.expoConfig?.hostUri as string | undefined;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && !LOCALHOST_PATTERN.test(host)) {
        return `http://${host}:3001`;
      }
    }
  } catch {
    // fall through
  }
  return 'http://localhost:3001';
}

export function getEnv(): string {
  if (process.env.EXPO_PUBLIC_ENV?.trim()) {
    return process.env.EXPO_PUBLIC_ENV.trim();
  }
  const fromExtra = readExtraEnv('env');
  if (fromExtra) return fromExtra;
  return __DEV__ ? 'development' : 'production';
}

export function isProduction(): boolean {
  return getEnv() === 'production';
}

export function getApiUrl(): string {
  if (isProduction()) {
    return resolvePublicEnv('EXPO_PUBLIC_API_URL', 'apiUrl');
  }
  if (process.env.EXPO_PUBLIC_API_URL?.trim()) {
    return stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL.trim());
  }
  return getDevApiUrl();
}

export function getSocketUrl(): string {
  if (isProduction()) {
    return resolvePublicEnv('EXPO_PUBLIC_SOCKET_URL', 'socketUrl');
  }
  if (process.env.EXPO_PUBLIC_SOCKET_URL?.trim()) {
    return stripTrailingSlash(process.env.EXPO_PUBLIC_SOCKET_URL.trim());
  }
  return getDevSocketUrl();
}

export function getAppUrl(): string {
  if (isProduction()) {
    return resolvePublicEnv('EXPO_PUBLIC_APP_URL', 'appUrl');
  }
  return stripTrailingSlash(
    process.env.EXPO_PUBLIC_APP_URL?.trim() || 'http://localhost:8081'
  );
}

export function getStorageUrl(): string {
  if (isProduction()) {
    return resolvePublicEnv('EXPO_PUBLIC_STORAGE_URL', 'storageUrl');
  }
  if (process.env.EXPO_PUBLIC_STORAGE_URL?.trim()) {
    return stripTrailingSlash(process.env.EXPO_PUBLIC_STORAGE_URL.trim());
  }
  return getAppUrl();
}

export function getAppName(): string {
  return process.env.EXPO_PUBLIC_APP_NAME?.trim() || 'AO Chats';
}

export const INIT_TIMEOUT_MS = 45000;
export const API_TIMEOUT_MS = 45000;

/** Wrap a promise with a timeout. Rejects if time expires (unless fallback is set). */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback?: T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fallback !== undefined) resolve(fallback);
      else reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function getVercelVariableChecklist(): { name: string; present: boolean }[] {
  const keys = [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_SOCKET_URL',
    'EXPO_PUBLIC_APP_URL',
    'EXPO_PUBLIC_STORAGE_URL',
    'EXPO_PUBLIC_ENV',
  ] as const;

  return keys.map((name) => ({
    name,
    present: Boolean(process.env[name]?.trim()),
  }));
}
