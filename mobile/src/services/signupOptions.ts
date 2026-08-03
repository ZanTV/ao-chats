import { api } from '../services/api';
import {
  AVATAR_CATEGORIES as LOCAL_AVATARS,
  UNIVERSITIES as LOCAL_UNIVERSITIES,
} from '../constants/signup';

export async function loadUniversities(): Promise<string[]> {
  try {
    const result = await api.getUniversities();
    if (result.universities?.length) return result.universities;
  } catch {
    // fall back to built-in list
  }
  return [...LOCAL_UNIVERSITIES];
}

export async function loadAvatarCategories(): Promise<Record<string, string[]>> {
  try {
    const result = await api.getAvatars();
    if (result.categories && Object.keys(result.categories).length > 0) {
      return result.categories;
    }
  } catch {
    // fall back to built-in list
  }
  return LOCAL_AVATARS;
}
