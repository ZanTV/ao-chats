/** Shared with backend attachment contract — keep fields in sync. */

export type AttachmentKind = 'image' | 'video' | 'document';

export interface MessageAttachment {
  id: string;
  kind: AttachmentKind;
  mimeType: string;
  fileName: string;
  fileSize: number;
  storageKey: string;
  url: string;
  width?: number;
  height?: number;
  duration?: number;
}

export const UPLOAD_LIMITS = {
  maxImageBytes: 12 * 1024 * 1024,
  maxVideoBytes: 40 * 1024 * 1024,
  maxDocumentBytes: 25 * 1024 * 1024,
  maxRecentMedia: 24,
} as const;

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

export function isMessageAttachment(value: unknown): value is MessageAttachment {
  if (!value || typeof value !== 'object') return false;
  const a = value as MessageAttachment;
  return (
    typeof a.id === 'string' &&
    typeof a.storageKey === 'string' &&
    typeof a.fileName === 'string' &&
    typeof a.mimeType === 'string' &&
    typeof a.url === 'string'
  );
}
