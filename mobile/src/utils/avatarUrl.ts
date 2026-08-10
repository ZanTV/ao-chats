/** True when a custom profile photo URL should take visual precedence over avatarId. */
export function hasValidAvatarUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.trim().length > 0;
}

/** Normalize avatarUrl — empty/whitespace becomes null (AO avatar fallback). */
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!hasValidAvatarUrl(url)) return null;
  return String(url).trim();
}

/** Append cache-busting version only when a custom avatar URL exists. */
export function bustAvatarUrl(
  url: string | null | undefined,
  version: number | null | undefined
): string | null {
  const normalized = normalizeAvatarUrl(url);
  if (!normalized) return null;
  const v = typeof version === 'number' && version > 0 ? version : 0;
  if (!v) return normalized;
  // Strip prior v= to avoid stacking
  const cleaned = normalized.replace(/([?&])v=\d+/g, '').replace(/[?&]$/, '');
  const join = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${join}v=${v}`;
}
