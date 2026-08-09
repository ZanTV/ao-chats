/** Shared attachment metadata contract (DB + clients + future media viewer). */

export type AttachmentKind = 'image' | 'video' | 'document';

export interface MessageAttachment {
  id: string;
  kind: AttachmentKind;
  mimeType: string;
  fileName: string;
  fileSize: number;
  storageKey: string;
  /** Authenticated download path or absolute URL */
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

export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export const ALLOWED_DOCUMENT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
]);

export function kindFromMime(mime: string): AttachmentKind {
  const m = mime.toLowerCase();
  if (ALLOWED_IMAGE_MIME.has(m) || m.startsWith('image/')) return 'image';
  if (ALLOWED_VIDEO_MIME.has(m) || m.startsWith('video/')) return 'video';
  return 'document';
}

export function messageTypeFromKind(kind: AttachmentKind): 'IMAGE' | 'FILE' {
  return kind === 'image' ? 'IMAGE' : 'FILE';
}

export function isAllowedMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    ALLOWED_IMAGE_MIME.has(m) ||
    ALLOWED_VIDEO_MIME.has(m) ||
    ALLOWED_DOCUMENT_MIME.has(m) ||
    m.startsWith('image/') ||
    m.startsWith('video/')
  );
}

export function maxBytesForMime(mime: string): number {
  const kind = kindFromMime(mime);
  if (kind === 'image') return UPLOAD_LIMITS.maxImageBytes;
  if (kind === 'video') return UPLOAD_LIMITS.maxVideoBytes;
  return UPLOAD_LIMITS.maxDocumentBytes;
}

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file';
  return base.slice(0, 180);
}

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
