import { useEffect } from 'react';
import { socketService } from '../services/socket';
import { useTypingStore } from '../stores/typingStore';
import { useAuthStore } from '../stores/authStore';
import { cacheManager } from '../cache';
import { CacheDomain } from '../cache/types';
import {
  invalidatePublicProfile,
  setCachedPublicProfile,
  type PublicProfileCache,
} from '../cache/profileCache';
import { applyAvatarSyncUpdate } from '../profile/avatarSyncStore';
import { api } from '../services/api';

type ProfileUpdatedPayload = {
  userId?: string;
  avatarVersion?: number;
  avatarUrl?: string | null;
  updatedAt?: string;
};

function patchCachedListAvatars(
  domain: typeof CacheDomain.CONVERSATIONS | typeof CacheDomain.FRIENDS,
  userId: string,
  avatarUrl: string | null,
  avatarVersion: number
) {
  try {
    const envelope = cacheManager.get<any>(domain);
    const data = envelope?.data;
    if (!data) return;

    if (domain === CacheDomain.CONVERSATIONS && Array.isArray(data)) {
      let changed = false;
      const next = data.map((c: any) => {
        if (c?.otherUser?.id !== userId) return c;
        changed = true;
        return {
          ...c,
          otherUser: {
            ...c.otherUser,
            avatarUrl,
            avatarVersion,
          },
        };
      });
      if (changed) {
        cacheManager.set(domain, next, envelope.version);
      }
      return;
    }

    // Friends payloads vary; best-effort deep patch of known shapes
    if (data && typeof data === 'object') {
      const patchUser = (u: any) => {
        if (!u || u.id !== userId) return u;
        return { ...u, avatarUrl, avatarVersion };
      };
      let changed = false;
      const clone: any = Array.isArray(data) ? [...data] : { ...data };
      if (Array.isArray(clone)) {
        for (let i = 0; i < clone.length; i++) {
          const row = clone[i];
          if (row?.id === userId) {
            clone[i] = patchUser(row);
            changed = true;
          } else if (row?.sender?.id === userId) {
            clone[i] = { ...row, sender: patchUser(row.sender) };
            changed = true;
          } else if (row?.receiver?.id === userId) {
            clone[i] = { ...row, receiver: patchUser(row.receiver) };
            changed = true;
          }
        }
      } else {
        for (const key of Object.keys(clone)) {
          const val = clone[key];
          if (Array.isArray(val)) {
            clone[key] = val.map((row: any) => {
              if (row?.id === userId) {
                changed = true;
                return patchUser(row);
              }
              if (row?.sender?.id === userId) {
                changed = true;
                return { ...row, sender: patchUser(row.sender) };
              }
              if (row?.receiver?.id === userId) {
                changed = true;
                return { ...row, receiver: patchUser(row.receiver) };
              }
              return row;
            });
          }
        }
      }
      if (changed) {
        cacheManager.set(domain, clone, envelope.version);
      }
    }
  } catch {
    // ignore cache patch errors
  }
}

async function hydratePublicProfile(
  userId: string,
  avatarVersion: number,
  avatarUrl?: string | null
) {
  try {
    const remote = (await api.getUser(userId)) as PublicProfileCache;
    const remoteVersion =
      typeof remote.avatarVersion === 'number' ? remote.avatarVersion : avatarVersion;
    if (remoteVersion < avatarVersion) return null;

    applyAvatarSyncUpdate({
      userId,
      avatarUrl: remote.avatarUrl ?? null,
      avatarVersion: remoteVersion,
    });
    setCachedPublicProfile({
      ...remote,
      avatarUrl: remote.avatarUrl ?? null,
      avatarVersion: remoteVersion,
    });
    patchCachedListAvatars(
      CacheDomain.CONVERSATIONS,
      userId,
      remote.avatarUrl ?? null,
      remoteVersion
    );
    patchCachedListAvatars(
      CacheDomain.FRIENDS,
      userId,
      remote.avatarUrl ?? null,
      remoteVersion
    );
    return remote;
  } catch {
    if (avatarUrl !== undefined) {
      applyAvatarSyncUpdate({ userId, avatarUrl, avatarVersion });
      patchCachedListAvatars(CacheDomain.CONVERSATIONS, userId, avatarUrl, avatarVersion);
      patchCachedListAvatars(CacheDomain.FRIENDS, userId, avatarUrl, avatarVersion);
    }
    return null;
  }
}

/** Subscribes to app-wide socket events (typing, profile avatar sync, etc.). */
export function GlobalRealtimeListeners() {
  const { isAuthenticated, user, refreshProfile, updateUser } = useAuthStore();
  const setTyping = useTypingStore((s) => s.setTyping);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    applyAvatarSyncUpdate({
      userId: user.id,
      avatarUrl: user.avatarUrl ?? null,
      avatarVersion: user.avatarVersion ?? 0,
    });
  }, [isAuthenticated, user?.id, user?.avatarUrl, user?.avatarVersion]);

  useEffect(() => {
    if (!isAuthenticated) return;

    socketService.connect();

    const unsubs = [
      socketService.on('typing:start', (data: unknown) => {
        const { conversationId, userId } = data as { conversationId: string; userId: string };
        if (userId !== user?.id) {
          setTyping(conversationId, true);
        }
      }),
      socketService.on('typing:stop', (data: unknown) => {
        const { conversationId } = data as { conversationId: string };
        setTyping(conversationId, false);
      }),
      socketService.on('message:delete', (data: unknown) => {
        const payload = data as {
          messageId?: string;
          conversationId?: string;
          forEveryone?: boolean;
          userId?: string;
        };
        if (!payload.messageId || !payload.conversationId) return;
        const hideForMe = payload.forEveryone || payload.userId === user?.id;
        if (!hideForMe) return;
        cacheManager.deleteMessages(payload.conversationId, [payload.messageId]).catch(() => {});
      }),
      socketService.on('profile_updated', (data: unknown) => {
        const payload = data as ProfileUpdatedPayload;
        const userId = payload?.userId;
        if (!userId) return;
        const version =
          typeof payload.avatarVersion === 'number' ? payload.avatarVersion : null;
        if (version == null) return;

        // Version gate — ignore late/stale events
        const applied = applyAvatarSyncUpdate({
          userId,
          avatarUrl: payload.avatarUrl,
          avatarVersion: version,
        });
        if (!applied && payload.avatarUrl === undefined) {
          // Still may need hydrate if we only had a stale version bump attempt
        }

        invalidatePublicProfile(userId);

        if (userId === user?.id) {
          const current = useAuthStore.getState().user;
          const currentVersion = current?.avatarVersion ?? 0;
          if (version >= currentVersion) {
            updateUser({
              avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl : current?.avatarUrl,
              avatarVersion: version,
            });
          }
          // Refresh authoritative owner profile (does not block UI — sync store already updated)
          void refreshProfile().then(() => {
            const me = useAuthStore.getState().user;
            if (me) {
              applyAvatarSyncUpdate({
                userId: me.id,
                avatarUrl: me.avatarUrl ?? null,
                avatarVersion: me.avatarVersion ?? version,
              });
            }
          });
        }

        // Patch list caches immediately when URL present; otherwise fetch public profile
        if (payload.avatarUrl !== undefined) {
          patchCachedListAvatars(
            CacheDomain.CONVERSATIONS,
            userId,
            payload.avatarUrl,
            version
          );
          patchCachedListAvatars(CacheDomain.FRIENDS, userId, payload.avatarUrl, version);
          void hydratePublicProfile(userId, version, payload.avatarUrl);
        } else {
          void hydratePublicProfile(userId, version);
        }
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isAuthenticated, user?.id, setTyping, refreshProfile, updateUser]);

  return null;
}
