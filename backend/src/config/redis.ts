import Redis, { RedisOptions } from 'ioredis';
import { config } from './index';

let redis: Redis | null = null;
let redisAvailable = false;
let errorLogged = false;

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function getRedis(): Redis | null {
  if (!redisAvailable) return null;

  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    redis.on('error', () => {
      if (!errorLogged) {
        console.warn('Redis connection lost — running without cache');
        errorLogged = true;
      }
      redisAvailable = false;
    });
  }
  return redis;
}

export interface CacheEnvelope<T> {
  v: number;
  updatedAt: string;
  data: T;
}

export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  userFriends: (id: string) => `friends:${id}`,
  conversation: (id: string) => `conversation:${id}`,
  userConversations: (id: string) => `conversations:${id}`,
  messages: (conversationId: string) => `messages:${conversationId}`,
  pinnedMessages: (conversationId: string) => `pins:${conversationId}`,
  starredMessages: (userId: string) => `stars:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  notificationCount: (userId: string) => `notifications:count:${userId}`,
  universities: 'static:universities',
  avatars: 'static:avatars',
  onlineUsers: 'online:users',
  version: (key: string) => `${key}:version`,
};

export const CacheTTL = {
  user: 3600,
  friends: 1800,
  conversation: 1800,
  conversations: 900,
  messages: 900,
  pins: 900,
  stars: 900,
  notifications: 600,
  static: 86400,
  online: 300,
};

export async function connectRedis(): Promise<boolean> {
  if (!config.redisUrl) {
    if (config.isProduction) {
      console.warn('REDIS_URL not set — running without cache');
    }
    return false;
  }

  try {
    const options: RedisOptions = {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy: () => null,
    };

    if (config.redisUrl.startsWith('rediss://')) {
      options.tls = { rejectUnauthorized: false };
    }

    const client = new Redis(config.redisUrl, options);
    await client.connect();
    await client.ping();
    redis = client;
    redisAvailable = true;
    client.on('error', () => {
      redisAvailable = false;
    });
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl?: number): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    const serialized = JSON.stringify(value);
    if (ttl) {
      await client.setex(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch {
    // cache optional
  }
}

export async function cacheGetVersioned<T>(
  key: string
): Promise<{ data: T; version: number } | null> {
  const envelope = await cacheGet<CacheEnvelope<T>>(key);
  if (!envelope || envelope.data === undefined) return null;
  return { data: envelope.data, version: envelope.v };
}

export async function cacheSetVersioned<T>(
  key: string,
  data: T,
  ttl: number
): Promise<number> {
  const version = Date.now();
  const envelope: CacheEnvelope<T> = {
    v: version,
    updatedAt: new Date(version).toISOString(),
    data,
  };
  await cacheSet(key, envelope, ttl);
  await cacheSet(CacheKeys.version(key), version, ttl);
  return version;
}

export async function cacheGetVersion(key: string): Promise<number | null> {
  const v = await cacheGet<number>(CacheKeys.version(key));
  return typeof v === 'number' ? v : null;
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    const client = getRedis();
    if (!client || keys.length === 0) return;
    const versionKeys = keys.map((k) => CacheKeys.version(k));
    await client.del(...keys, ...versionKeys);
  } catch {
    // cache optional
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;

    let cursor = '0';
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      const versionKeys = keysToDelete.map((k) => CacheKeys.version(k));
      await client.del(...keysToDelete, ...versionKeys);
    }
  } catch {
    // cache optional
  }
}
