import { cacheManager, CacheDomain } from '../cache';

export type PublicProfileCache = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarId: string;
  avatarUrl?: string | null;
  avatarVersion?: number;
  university?: string | null;
  course?: string | null;
  bio?: string | null;
  status?: string;
  statusMessage?: string | null;
  lastSeen?: string | null;
  isVerified?: boolean;
  isSystemAccount?: boolean;
  updatedAt?: string;
};

export function getCachedPublicProfile(userId: string): PublicProfileCache | null {
  const envelope = cacheManager.get<PublicProfileCache>(CacheDomain.PUBLIC_PROFILE, userId);
  return envelope?.data ?? null;
}

export function setCachedPublicProfile(profile: PublicProfileCache): void {
  const version =
    typeof profile.avatarVersion === 'number'
      ? profile.avatarVersion
      : Date.parse(profile.updatedAt || '') || Date.now();
  cacheManager.set(CacheDomain.PUBLIC_PROFILE, profile, version, profile.id);
}

export function invalidatePublicProfile(userId: string): void {
  cacheManager.remove(CacheDomain.PUBLIC_PROFILE, userId);
}
