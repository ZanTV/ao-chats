/**
 * Centralized environment configuration for AO Chats mobile.
 * Production uses EXPO_PUBLIC_* variables — no localhost in production builds.
 */

const PRODUCTION = {
  apiUrl: 'https://api.aochats.chat/api',
  socketUrl: 'https://api.aochats.chat',
  appUrl: 'https://www.aochats.chat',
  env: 'production',
} as const;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function isProductionBuild(): boolean {
  return (
    process.env.EXPO_PUBLIC_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

function getDevApiUrl(): string {
  // Expo Go / dev client: use LAN IP from Metro when available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const hostUri = Constants.expoConfig?.hostUri as string | undefined;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
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
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:3001`;
      }
    }
  } catch {
    // fall through
  }
  return 'http://localhost:3001';
}

export function getEnv(): string {
  if (process.env.EXPO_PUBLIC_ENV) return process.env.EXPO_PUBLIC_ENV;
  return __DEV__ ? 'development' : PRODUCTION.env;
}

export function isProduction(): boolean {
  return getEnv() === 'production';
}

export function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL);
  }
  if (isProductionBuild() || !__DEV__) {
    return PRODUCTION.apiUrl;
  }
  return getDevApiUrl();
}

export function getSocketUrl(): string {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return stripTrailingSlash(process.env.EXPO_PUBLIC_SOCKET_URL);
  }
  if (isProductionBuild() || !__DEV__) {
    return PRODUCTION.socketUrl;
  }
  return getDevSocketUrl();
}

export function getAppUrl(): string {
  return process.env.EXPO_PUBLIC_APP_URL || PRODUCTION.appUrl;
}

export function getAppName(): string {
  return process.env.EXPO_PUBLIC_APP_NAME || 'AO Chats';
}

export const INIT_TIMEOUT_MS = 12000;
export const API_TIMEOUT_MS = 15000;

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
