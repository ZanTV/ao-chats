/** Shared with backend attachment contract — keep fields in sync. */

import { getApiUrl } from '../services/config';

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
    typeof a.mimeType === 'string'
  );
}

/** Coerce API attachment JSON into a usable MessageAttachment (url optional). */
export function coerceAttachment(value: unknown): MessageAttachment | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Partial<MessageAttachment> & { kind?: string };
  if (typeof a.id !== 'string' || typeof a.storageKey !== 'string') return null;
  const mime = typeof a.mimeType === 'string' ? a.mimeType : 'application/octet-stream';
  const kindRaw = a.kind;
  const kind: AttachmentKind =
    kindRaw === 'image' || kindRaw === 'video' || kindRaw === 'document'
      ? kindRaw
      : mime.startsWith('image/')
        ? 'image'
        : mime.startsWith('video/')
          ? 'video'
          : 'document';
  const fileName = typeof a.fileName === 'string' ? a.fileName : 'file';
  const storageKey = a.storageKey;
  const base = getApiUrl().replace(/\/$/, '');
  return {
    id: a.id,
    storageKey,
    fileName,
    mimeType: mime,
    fileSize: typeof a.fileSize === 'number' ? a.fileSize : 0,
    kind,
    url: `${base}/uploads/files?key=${encodeURIComponent(storageKey)}`,
    width: a.width,
    height: a.height,
    duration: a.duration,
  };
}
