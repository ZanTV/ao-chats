import { normalizeAvatarUrl } from '../utils/avatarUrl';
import { resolveAvatarProjection } from './avatarSyncStore';

export type ResolvedAvatarType = 'photo' | 'ao' | 'default';

export type ResolvedAvatar = {
  /** Effective visual kind after precedence. */
  type: ResolvedAvatarType;
  /**
   * Visual source:
   * - photo → avatarUrl (proxy / local)
   * - ao / default → avatarId
   */
  source: string;
  avatarUrl: string | null;
  avatarId: string;
  version: number;
};

const DEFAULT_AVATAR_ID = 'avatar-1';

function normalizeVersion(version: number | null | undefined): number {
  return typeof version === 'number' && Number.isFinite(version)
    ? Math.max(0, Math.floor(version))
    : 0;
}

function normalizeAvatarId(avatarId: string | null | undefined): string {
  const id = typeof avatarId === 'string' ? avatarId.trim() : '';
  return id || DEFAULT_AVATAR_ID;
}

/**
 * Pure avatar precedence (no sync store):
 * REAL PROFILE PHOTO > AO AVATAR > DEFAULT AO AVATAR
 *
 * Does NOT delete or ignore avatarId when a photo exists — avatarId remains
 * available as fallback when avatarUrl is null.
 */
export function resolveAvatar(input: {
  avatarId?: string | null;
  avatarUrl?: string | null;
  avatarVersion?: number | null;
}): ResolvedAvatar {
  const version = normalizeVersion(input.avatarVersion);
  const avatarId = normalizeAvatarId(input.avatarId);
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);

  if (avatarUrl) {
    return {
      type: 'photo',
      source: avatarUrl,
      avatarUrl,
      avatarId,
      version,
    };
  }

  if (typeof input.avatarId === 'string' && input.avatarId.trim()) {
    return {
      type: 'ao',
      source: avatarId,
      avatarUrl: null,
      avatarId,
      version,
    };
  }

  return {
    type: 'default',
    source: DEFAULT_AVATAR_ID,
    avatarUrl: null,
    avatarId: DEFAULT_AVATAR_ID,
    version,
  };
}

/**
 * Single effective projection for UI:
 * 1. avatarSyncStore (version-gated) when userId is known
 * 2. props avatarUrl / avatarVersion
 * 3. avatarId / default
 */
export function resolveEffectiveAvatar(input: {
  userId?: string | null;
  avatarId?: string | null;
  avatarUrl?: string | null;
  avatarVersion?: number | null;
}): ResolvedAvatar {
  const projected = resolveAvatarProjection(
    input.userId,
    input.avatarUrl,
    input.avatarVersion
  );
  return resolveAvatar({
    avatarId: input.avatarId,
    avatarUrl: projected.avatarUrl,
    avatarVersion: projected.avatarVersion,
  });
}
