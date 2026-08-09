import type { PendingAttachment } from '../attachments/pending';

let pending: PendingAttachment | null = null;

export function setPendingAvatarPhoto(file: PendingAttachment | null) {
  pending = file;
}

export function takePendingAvatarPhoto(): PendingAttachment | null {
  const next = pending;
  pending = null;
  return next;
}

export function peekPendingAvatarPhoto(): PendingAttachment | null {
  return pending;
}
