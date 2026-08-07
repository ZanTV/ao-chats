import { api } from '../services/api';
import {
  AVATAR_CATEGORIES as LOCAL_AVATARS,
  UNIVERSITIES as LOCAL_UNIVERSITIES,
} from '../constants/signup';
import { cacheManager, CacheDomain } from '../cache';

export async function loadUniversities(): Promise<string[]> {
  const cached = cacheManager.get<string[]>(CacheDomain.UNIVERSITIES)?.data;
  if (cached?.length) {
    api.getUniversities()
      .then((result) => {
        if (result.universities?.length) {
          cacheManager.set(CacheDomain.UNIVERSITIES, result.universities, result.cacheVersion);
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const result = await api.getUniversities();
    if (result.universities?.length) {
      cacheManager.set(CacheDomain.UNIVERSITIES, result.universities, result.cacheVersion);
      return result.universities;
    }
  } catch {
    // fall back to built-in list
  }
  cacheManager.set(CacheDomain.UNIVERSITIES, [...LOCAL_UNIVERSITIES]);
  return [...LOCAL_UNIVERSITIES];
}

export async function loadAvatarCategories(): Promise<Record<string, string[]>> {
  const cached = cacheManager.get<Record<string, string[]>>(CacheDomain.AVATARS)?.data;
  if (cached && Object.keys(cached).length > 0) {
    api.getAvatars()
      .then((result) => {
        if (result.categories && Object.keys(result.categories).length > 0) {
          cacheManager.set(CacheDomain.AVATARS, result.categories, result.cacheVersion);
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const result = await api.getAvatars();
    if (result.categories && Object.keys(result.categories).length > 0) {
      cacheManager.set(CacheDomain.AVATARS, result.categories, result.cacheVersion);
      return result.categories;
    }
  } catch {
    // fall back to built-in list
  }
  cacheManager.set(CacheDomain.AVATARS, LOCAL_AVATARS);
  return LOCAL_AVATARS;
}
