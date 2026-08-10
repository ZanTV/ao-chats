import { useEffect } from 'react';
import { useAvatarSyncStore } from './avatarSyncStore';

/**
 * Invoke `onAvatar` whenever a user's avatar projection gains an explicit URL/version.
 * Used to patch in-memory list/header state without full list reload.
 */
export function useLiveAvatarPatches(
  onAvatar: (userId: string, avatarUrl: string | null, avatarVersion: number) => void
): void {
  useEffect(() => {
    return useAvatarSyncStore.subscribe((state, prev) => {
      if (state.revision === prev.revision) return;
      for (const userId of Object.keys(state.byUserId)) {
        const cur = state.byUserId[userId];
        if (!cur?.urlKnown) continue;
        const old = prev.byUserId[userId];
        if (
          !old ||
          !old.urlKnown ||
          old.avatarVersion !== cur.avatarVersion ||
          old.avatarUrl !== cur.avatarUrl
        ) {
          onAvatar(userId, cur.avatarUrl, cur.avatarVersion);
        }
      }
    });
  }, [onAvatar]);
}
