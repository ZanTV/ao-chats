import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mmkvGet, mmkvSet, mmkvDelete } from '../cache/mmkvStore';
import { CacheDomain } from '../cache/types';

const TOKEN_KEY = 'ao_access_token';
const REFRESH_KEY = 'ao_refresh_token';

const isWeb = Platform.OS === 'web';

function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

async function memoryFallbackGet(key: string): Promise<string | null> {
  try {
    const g = globalThis as unknown as { __aoMem?: Map<string, string> };
    if (g.__aoMem) return g.__aoMem.get(key) ?? null;
  } catch {
    // ignore
  }
  return null;
}

async function memoryFallbackSet(key: string, value: string): Promise<void> {
  try {
    const g = globalThis as { __aoMem?: Map<string, string> };
    if (!g.__aoMem) g.__aoMem = new Map();
    g.__aoMem.set(key, value);
  } catch {
    // ignore
  }
}

async function memoryFallbackDelete(key: string): Promise<void> {
  try {
    (globalThis as { __aoMem?: Map<string, string> }).__aoMem?.delete(key);
  } catch {
    // ignore
  }
}

async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch {
      // fall through to memory
    }
    await memoryFallbackSet(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } catch {
    await memoryFallbackSet(key, value);
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {
      // fall through
    }
    return memoryFallbackGet(key);
  }
  try {
    return await SecureStore.getItemAsync(key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } catch {
    return memoryFallbackGet(key);
  }
}

async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    await memoryFallbackDelete(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
  await memoryFallbackDelete(key);
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    setSecureItem(TOKEN_KEY, accessToken),
    setSecureItem(REFRESH_KEY, refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return getSecureItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(REFRESH_KEY);
}

export async function clearTokens() {
  await Promise.all([
    deleteSecureItem(TOKEN_KEY),
    deleteSecureItem(REFRESH_KEY),
    clearCachedUser(),
  ]);
}

/** AsyncStorage — lightweight preferences only (theme, language, onboarding) */
async function preferenceSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`pref:${key}`, value);
  } catch {
    if (isWeb) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(`pref:${key}`, value);
        else await memoryFallbackSet(`pref:${key}`, value);
      } catch {
        await memoryFallbackSet(`pref:${key}`, value);
      }
    } else {
      await memoryFallbackSet(`pref:${key}`, value);
    }
  }
}

async function preferenceGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`pref:${key}`);
  } catch {
    if (isWeb) {
      try {
        if (typeof localStorage !== 'undefined') return localStorage.getItem(`pref:${key}`);
      } catch {
        // ignore
      }
    }
    return memoryFallbackGet(`pref:${key}`);
  }
}

/** MMKV — fast local cache for user profile */
export async function cacheUser(user: unknown) {
  const raw = safeStringify({ version: Date.now(), updatedAt: new Date().toISOString(), data: user });
  if (!raw) return;
  mmkvSet(`cache:${CacheDomain.USER_PROFILE}`, raw);
}

export async function getCachedUser<T>(): Promise<T | null> {
  const raw = mmkvGet(`cache:${CacheDomain.USER_PROFILE}`);
  const envelope = safeParse<{ data: T }>(raw);
  return envelope?.data ?? null;
}

export async function clearCachedUser() {
  mmkvDelete(`cache:${CacheDomain.USER_PROFILE}`);
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const raw = await preferenceGet(key);
  const parsed = safeParse<T>(raw);
  return parsed ?? defaultValue;
}

export async function setSetting(key: string, value: unknown) {
  const raw = safeStringify(value);
  if (!raw) return;
  await preferenceSet(key, raw);
}

/** Re-export cache helpers — heavy data lives in MMKV/SQLite via cacheManager */
export { cacheData, getCachedData, clearCache, cacheManager } from '../cache';
