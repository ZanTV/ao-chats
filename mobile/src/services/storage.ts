import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'ao_access_token';
const REFRESH_KEY = 'ao_refresh_token';
const USER_CACHE_KEY = 'cache:user_profile';

const isWeb = Platform.OS === 'web';

function safeParse<T>(raw: string | null): T | null {
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
    if (typeof globalThis !== 'undefined' && (globalThis as { __aoMem?: Map<string, string> }).__aoMem) {
      return (globalThis as { __aoMem: Map<string, string> }).__aoMem.get(key) ?? null;
    }
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

async function storageSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    if (isWeb) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        else await memoryFallbackSet(key, value);
      } catch {
        await memoryFallbackSet(key, value);
      }
    } else {
      await memoryFallbackSet(key, value);
    }
  }
}

async function storageGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    if (isWeb) {
      try {
        if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
      } catch {
        // ignore
      }
    }
    return memoryFallbackGet(key);
  }
}

async function storageRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  await memoryFallbackDelete(key);
}

export async function cacheUser(user: unknown) {
  const raw = safeStringify(user);
  if (!raw) return;
  await storageSet(USER_CACHE_KEY, raw);
}

export async function getCachedUser<T>(): Promise<T | null> {
  const raw = await storageGet(USER_CACHE_KEY);
  return safeParse<T>(raw);
}

export async function clearCachedUser() {
  await storageRemove(USER_CACHE_KEY);
}

export async function cacheData(key: string, data: unknown) {
  const raw = safeStringify(data);
  if (!raw) return;
  await storageSet(`cache:${key}`, raw);
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const raw = await storageGet(`cache:${key}`);
  return safeParse<T>(raw);
}

export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith('cache:'));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // ignore — cache clear is best-effort
  }
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const raw = await storageGet(`setting:${key}`);
  const parsed = safeParse<T>(raw);
  return parsed ?? defaultValue;
}

export async function setSetting(key: string, value: unknown) {
  const raw = safeStringify(value);
  if (!raw) return;
  await storageSet(`setting:${key}`, raw);
}
