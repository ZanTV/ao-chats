import { useAvatarSyncStore } from './avatarSyncStore';
import { resolveEffectiveAvatar, type ResolvedAvatar } from './resolveAvatar';

/**
 * Reactive resolved avatar for a user.
 * Subscribes to avatarSyncStore so version-gated realtime updates re-render.
 */
export function useResolvedAvatar(input: {
  userId?: string | null;
  avatarId?: string | null;
  avatarUrl?: string | null;
  avatarVersion?: number | null;
}): ResolvedAvatar {
  const userId = input.userId ? String(input.userId).trim() : '';
  // Subscribe so Avatar / callers re-render when sync projection changes.
  useAvatarSyncStore((s) => (userId ? s.byUserId[userId] : undefined));
  return resolveEffectiveAvatar(input);
}
