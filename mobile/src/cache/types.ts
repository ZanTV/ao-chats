export interface CacheEnvelope<T> {
  version: number;
  updatedAt: string;
  data: T;
}

export interface VersionedFetchResult<T> {
  data: T;
  cacheVersion?: number;
}

export const MESSAGE_PAGE_SIZE = 30;

export const CacheDomain = {
  USER_PROFILE: 'user_profile',
  FRIENDS: 'friends',
  CONVERSATIONS: 'conversations',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_COUNT: 'notification_count',
  STARRED: 'starred',
  UNIVERSITIES: 'universities',
  AVATARS: 'avatars',
  SEARCH_HISTORY: 'search_history',
  COURSE_LIST: 'course_list',
} as const;

export type CacheDomainKey = (typeof CacheDomain)[keyof typeof CacheDomain];
