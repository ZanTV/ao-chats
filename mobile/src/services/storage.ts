import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'ao_access_token';
const REFRESH_KEY = 'ao_refresh_token';

const isWeb = Platform.OS === 'web';

async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } catch {
    // Fallback: token storage failed — auth will prompt login
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } catch {
    return null;
  }
}

async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await setSecureItem(TOKEN_KEY, accessToken);
  await setSecureItem(REFRESH_KEY, refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return getSecureItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(REFRESH_KEY);
}

export async function clearTokens() {
  await deleteSecureItem(TOKEN_KEY);
  await deleteSecureItem(REFRESH_KEY);
  await clearCachedUser();
}

const USER_CACHE_KEY = 'cache:user_profile';

export async function cacheUser(user: unknown) {
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export async function getCachedUser<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearCachedUser() {
  await AsyncStorage.removeItem(USER_CACHE_KEY);
}

export async function cacheData(key: string, data: unknown) {
  await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(data));
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`cache:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function clearCache() {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith('cache:'));
  if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const raw = await AsyncStorage.getItem(`setting:${key}`);
  return raw ? JSON.parse(raw) : defaultValue;
}

export async function setSetting(key: string, value: unknown) {
  await AsyncStorage.setItem(`setting:${key}`, JSON.stringify(value));
}
