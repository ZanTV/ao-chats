/** Append cache-busting version only when a custom avatar URL exists. */
export function bustAvatarUrl(
  url: string | null | undefined,
  version: number | null | undefined
): string | null {
  if (!url) return null;
  const v = typeof version === 'number' && version > 0 ? version : 0;
  if (!v) return url;
  const sep = url.includes('?') ? '&' : '?';
  // Strip prior v= to avoid stacking
  const cleaned = url.replace(/([?&])v=\d+/g, '').replace(/[?&]$/, '');
  const join = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${join}v=${v}`;
}
