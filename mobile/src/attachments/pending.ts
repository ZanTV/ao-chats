import type { MessageAttachment } from './types';
import { UPLOAD_LIMITS } from './types';

export type PendingAttachment = {
  localUri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  kind: MessageAttachment['kind'];
  width?: number;
  height?: number;
  /** Local preview for images/videos */
  previewUri?: string;
  duration?: number;
};

export function kindFromMimeClient(mime: string): MessageAttachment['kind'] {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  return 'document';
}

export function messageTypeFromKindClient(kind: MessageAttachment['kind']): 'IMAGE' | 'FILE' {
  return kind === 'image' ? 'IMAGE' : 'FILE';
}

export function maxBytesForKind(kind: MessageAttachment['kind']): number {
  if (kind === 'image') return UPLOAD_LIMITS.maxImageBytes;
  if (kind === 'video') return UPLOAD_LIMITS.maxVideoBytes;
  return UPLOAD_LIMITS.maxDocumentBytes;
}

export function validatePendingAttachment(file: PendingAttachment): string | null {
  if (!file.localUri) return 'Upload failed. Try again.';
  if (file.fileSize < 0) return 'Empty file.';
  if (file.fileSize > 0 && file.fileSize > maxBytesForKind(file.kind)) {
    return 'This file is too large to upload.';
  }
  return null;
}
