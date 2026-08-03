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

export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  userFriends: (id: string) => `friends:${id}`,
  conversation: (id: string) => `conversation:${id}`,
  userConversations: (id: string) => `conversations:${id}`,
  messages: (conversationId: string) => `messages:${conversationId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  onlineUsers: 'online:users',
};

export const CacheTTL = {
  user: 3600,
  friends: 1800,
  conversation: 1800,
  messages: 900,
  notifications: 600,
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

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    const client = getRedis();
    if (!client || keys.length === 0) return;
    await client.del(...keys);
  } catch {
    // cache optional
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(...keys);
  } catch {
    // cache optional
  }
}
