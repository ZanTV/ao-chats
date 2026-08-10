import { create } from 'zustand';
import { normalizeAvatarUrl } from '../utils/avatarUrl';

export type AvatarSyncEntry = {
  avatarUrl: string | null;
  avatarVersion: number;
  /** True only when avatarUrl was explicitly provided (upload/event/hydrate/clear). */
  urlKnown: boolean;
  updatedAt: number;
};

type AvatarSyncState = {
  byUserId: Record<string, AvatarSyncEntry>;
  /** Monotonic counter — screens can subscribe to force list patches. */
  revision: number;
  /**
   * Apply a remote/local avatar update only if version is newer (or same with URL change).
   * Returns true when the store entry changed.
   */
  apply: (input: {
    userId: string;
    avatarUrl?: string | null;
    avatarVersion?: number | null;
  }) => boolean;
  get: (userId: string) => AvatarSyncEntry | undefined;
  clearUser: (userId: string) => void;
};

/**
 * In-memory avatar projection for instant UI updates across screens.
 * Source of truth remains User.avatarUrl / avatarVersion from the API.
 */
export const useAvatarSyncStore = create<AvatarSyncState>((set, get) => ({
  byUserId: {},
  revision: 0,

  apply: ({ userId, avatarUrl, avatarVersion }) => {
    const id = String(userId || '').trim();
    if (!id) return false;
    const version =
      typeof avatarVersion === 'number' && Number.isFinite(avatarVersion)
        ? Math.max(0, Math.floor(avatarVersion))
        : null;
    if (version == null) return false;

    const prev = get().byUserId[id];
    if (prev && version < prev.avatarVersion) {
      return false;
    }

    // Version-only event (no avatarUrl field): never invent null URL that masks props.
    if (avatarUrl === undefined) {
      if (!prev) return false;
      if (version === prev.avatarVersion) return false;
      set((state) => ({
        revision: state.revision + 1,
        byUserId: {
          ...state.byUserId,
          [id]: {
            ...prev,
            avatarVersion: version,
            updatedAt: Date.now(),
          },
        },
      }));
      return true;
    }

    // Explicit URL (string or null for clear) — empty/whitespace → null (AO fallback)
    const nextUrl = avatarUrl === null ? null : normalizeAvatarUrl(avatarUrl);
    if (
      prev &&
      version === prev.avatarVersion &&
      prev.urlKnown &&
      prev.avatarUrl === nextUrl
    ) {
      return false;
    }

    set((state) => ({
      revision: state.revision + 1,
      byUserId: {
        ...state.byUserId,
        [id]: {
          avatarUrl: nextUrl,
          avatarVersion: version,
          urlKnown: true,
          updatedAt: Date.now(),
        },
      },
    }));
    return true;
  },

  get: (userId) => get().byUserId[String(userId || '').trim()],

  clearUser: (userId) => {
    const id = String(userId || '').trim();
    if (!id) return;
    set((state) => {
      if (!state.byUserId[id]) return state;
      const next = { ...state.byUserId };
      delete next[id];
      return { byUserId: next, revision: state.revision + 1 };
    });
  },
}));

export function applyAvatarSyncUpdate(input: {
  userId: string;
  avatarUrl?: string | null;
  avatarVersion?: number | null;
}): boolean {
  return useAvatarSyncStore.getState().apply(input);
}

/**
 * Single precedence rule: valid avatarUrl (sync or props) wins over avatarId.
 * Callers still pass avatarId separately for AO fallback rendering.
 */
export function resolveAvatarProjection(
  userId: string | null | undefined,
  imageUrl: string | null | undefined,
  imageVersion: number | null | undefined
): { avatarUrl: string | null; avatarVersion: number } {
  const propVersion =
    typeof imageVersion === 'number' && Number.isFinite(imageVersion)
      ? imageVersion
      : 0;
  const propUrl = normalizeAvatarUrl(imageUrl);
  const id = String(userId || '').trim();
  if (!id) {
    return { avatarUrl: propUrl, avatarVersion: propVersion };
  }
  const synced = useAvatarSyncStore.getState().byUserId[id];
  if (!synced || !synced.urlKnown) {
    return { avatarUrl: propUrl, avatarVersion: propVersion };
  }
  if (synced.avatarVersion >= propVersion) {
    return {
      avatarUrl: normalizeAvatarUrl(synced.avatarUrl),
      avatarVersion: synced.avatarVersion,
    };
  }
  return { avatarUrl: propUrl, avatarVersion: propVersion };
}
