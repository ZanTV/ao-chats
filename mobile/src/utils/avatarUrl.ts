import { getApiUrl } from '../services/config';

/** True when a custom profile photo URL should take visual precedence over avatarId. */
export function hasValidAvatarUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.trim().length > 0;
}

/** Normalize avatarUrl — empty/whitespace becomes null (AO avatar fallback). */
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!hasValidAvatarUrl(url)) return null;
  return String(url).trim();
}

function isLocalAvatarUri(url: string): boolean {
  return (
    url.startsWith('file:') ||
    url.startsWith('content:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('ph://') ||
    url.startsWith('assets-library:')
  );
}

/**
 * Rewrite proxy avatar URLs onto the current API base (device LAN vs localhost, etc.)
 * then apply version cache-bust. Local/device URIs are left intact.
 */
export function resolveAvatarDisplayUrl(
  url: string | null | undefined,
  version: number | null | undefined
): string | null {
  const normalized = normalizeAvatarUrl(url);
  if (!normalized) return null;
  if (isLocalAvatarUri(normalized)) return normalized;

  let absolute = normalized;
  try {
    const apiBase = getApiUrl().replace(/\/$/, '');
    if (normalized.startsWith('/')) {
      // apiBase already includes /api — accept /uploads/... or /api/uploads/...
      const path = normalized.startsWith('/api/') ? normalized.slice(4) : normalized;
      absolute = `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
    } else {
      const marker = '/uploads/files?';
      const idx = normalized.indexOf(marker);
      if (idx >= 0) {
        absolute = `${apiBase}${normalized.slice(idx)}`;
      }
    }
  } catch {
    absolute = normalized;
  }

  return bustAvatarUrl(absolute, version);
}

/** Append cache-busting version only when a custom avatar URL exists. */
export function bustAvatarUrl(
  url: string | null | undefined,
  version: number | null | undefined
): string | null {
  const normalized = normalizeAvatarUrl(url);
  if (!normalized) return null;
  if (isLocalAvatarUri(normalized)) return normalized;
  const v = typeof version === 'number' && version > 0 ? version : 0;
  if (!v) return normalized;
  // Strip prior v= to avoid stacking
  const cleaned = normalized.replace(/([?&])v=\d+/g, '').replace(/[?&]$/, '');
  const join = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${join}v=${v}`;
}
