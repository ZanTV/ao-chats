export function validateMobileNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s\-().]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return 'Use international format e.g. +254712345678';
  }
  return null;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatLastSeen(dateStr: string | undefined, online: boolean): string {
  if (online) return 'Online now';
  if (!dateStr) return 'Offline';
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'Last seen just now';
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  return `Last seen ${date.toLocaleDateString()}`;
}
