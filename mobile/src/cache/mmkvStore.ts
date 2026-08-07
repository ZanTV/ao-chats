/**
 * Fast local cache with optional native MMKV (v2) + AsyncStorage fallback.
 *
 * - EAS / dev builds: uses react-native-mmkv@2.12.2 (no Nitro, no New Architecture required)
 * - Expo Go / web: falls back to memory + AsyncStorage (same public API)
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@ao_cache:';
const MMKV_ID = 'ao-chats-cache';

const memoryStore = new Map<string, string>();

type MmkvLike = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
  getAllKeys: () => string[];
  clearAll: () => void;
};

let mmkv: MmkvLike | null = null;
let mmkvInitAttempted = false;

let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function getMmkv(): MmkvLike | null {
  if (mmkvInitAttempted) return mmkv;
  mmkvInitAttempted = true;

  if (Platform.OS === 'web') return null;

  try {
    // Lazy require — v2 does not pull in react-native-nitro-modules (unlike v4)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (config?: { id: string }) => MmkvLike;
    };
    mmkv = new MMKV({ id: MMKV_ID });
  } catch {
    mmkv = null;
  }

  return mmkv;
}

function persistKey(key: string, value: string): void {
  AsyncStorage.setItem(STORAGE_PREFIX + key, value).catch(() => {});
}

function removeKey(key: string): void {
  AsyncStorage.removeItem(STORAGE_PREFIX + key).catch(() => {});
}

/** Migrate legacy AsyncStorage cache entries into MMKV (one-time). */
async function migrateAsyncStorageToMmkv(store: MmkvLike): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));
    if (cacheKeys.length === 0) return;

    const pairs = await AsyncStorage.multiGet(cacheKeys);
    for (const [storageKey, value] of pairs) {
      if (value != null) {
        const key = storageKey.slice(STORAGE_PREFIX.length);
        if (!store.getString(key)) {
          store.set(key, value);
        }
      }
    }
  } catch {
    // best-effort migration
  }
}

/** Load persisted cache — call once at app startup. */
export async function hydrateLocalCache(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const store = getMmkv();

    if (store) {
      await migrateAsyncStorageToMmkv(store);
      hydrated = true;
      return;
    }

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));
      if (cacheKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(cacheKeys);
        for (const [storageKey, value] of pairs) {
          if (value != null) {
            memoryStore.set(storageKey.slice(STORAGE_PREFIX.length), value);
          }
        }
      }
    } catch {
      // proceed with empty memory cache
    }

    hydrated = true;
  })();

  return hydratePromise;
}

export function mmkvGet(key: string): string | undefined {
  const store = getMmkv();
  if (store) {
    try {
      return store.getString(key);
    } catch {
      // fall through
    }
  }
  return memoryStore.get(key);
}

export function mmkvSet(key: string, value: string): void {
  const store = getMmkv();
  if (store) {
    try {
      store.set(key, value);
      return;
    } catch {
      // fall through
    }
  }
  memoryStore.set(key, value);
  persistKey(key, value);
}

export function mmkvDelete(key: string): void {
  const store = getMmkv();
  if (store) {
    try {
      store.delete(key);
      return;
    } catch {
      // fall through
    }
  }
  memoryStore.delete(key);
  removeKey(key);
}

export function mmkvGetAllKeys(prefix?: string): string[] {
  const store = getMmkv();
  if (store) {
    try {
      const keys = store.getAllKeys();
      return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
    } catch {
      // fall through
    }
  }
  const keys = [...memoryStore.keys()];
  return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
}

export async function mmkvClearPrefix(prefix: string): Promise<void> {
  const toDelete = mmkvGetAllKeys(prefix);
  const store = getMmkv();

  if (store) {
    try {
      for (const k of toDelete) store.delete(k);
      return;
    } catch {
      // fall through
    }
  }

  for (const k of toDelete) {
    memoryStore.delete(k);
  }
  try {
    const storageKeys = toDelete.map((k) => STORAGE_PREFIX + k);
    if (storageKeys.length > 0) await AsyncStorage.multiRemove(storageKeys);
  } catch {
    // best-effort
  }
}

export async function mmkvClearAll(): Promise<void> {
  const store = getMmkv();
  if (store) {
    try {
      store.clearAll();
      return;
    } catch {
      // fall through
    }
  }

  memoryStore.clear();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // best-effort
  }
}

/** Which backend is active (for diagnostics). */
export function getLocalCacheBackend(): 'mmkv' | 'async-storage' {
  return getMmkv() ? 'mmkv' : 'async-storage';
}
