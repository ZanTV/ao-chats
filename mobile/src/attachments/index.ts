export type { MessageAttachment, AttachmentKind } from './types';
export { formatFileSize, isMessageAttachment, coerceAttachment, UPLOAD_LIMITS } from './types';
export type { PendingAttachment } from './pending';
export {
  kindFromMimeClient,
  messageTypeFromKindClient,
  validatePendingAttachment,
} from './pending';
export { uploadAttachment } from './upload';
export {
  ensureLocalAttachment,
  getLocalAttachment,
  seedLocalAttachment,
  clearAttachmentCache,
  buildMediaShareLink,
  saveAttachmentToDevice,
  shareAttachmentFile,
  resolveAttachmentUrl,
  invalidateLocalAttachment,
} from './storage';
