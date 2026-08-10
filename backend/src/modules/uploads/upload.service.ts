import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../config/database';
import {
  kindFromMime,
  maxBytesForMime,
  isAllowedMime,
  sanitizeFileName,
  ALLOWED_IMAGE_MIME,
  UPLOAD_LIMITS,
  buildAttachmentProxyUrl,
  type MessageAttachment,
} from '../../utils/attachment';
import {
  agrohubStorage,
  attachmentBelongsToConversation,
  isAgrohubChatStorageKey,
  isValidProfileStorageKey,
} from './agrohubStorage.client';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

function ensureUploadRoot() {
  if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
}

export function resolveUploadPath(storageKey: string): string {
  const safe = storageKey.replace(/\.\./g, '').replace(/\\/g, '/');
  const full = path.resolve(UPLOAD_ROOT, safe);
  if (!full.startsWith(UPLOAD_ROOT)) {
    throw new AppError(400, 'Invalid storage key');
  }
  return full;
}

function proxyAttachmentUrl(storageKey: string): string {
  return buildAttachmentProxyUrl(storageKey, config.apiUrl);
}

function mimeFromFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeByExt: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return mimeByExt[ext] || 'application/octet-stream';
}

function localFileExists(storageKey: string): boolean {
  try {
    const full = resolveUploadPath(storageKey);
    return fs.existsSync(full);
  } catch {
    return false;
  }
}

export class UploadService {
  /**
   * Persist a chat attachment.
   * When MEDIA_STORAGE_PROVIDER=agrohub, uploads to storage.agrohub.ltd.
   * Otherwise writes to local uploads/ (legacy).
   */
  async saveLocalUpload(params: {
    uploaderId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    width?: number;
    height?: number;
    conversationId?: string;
  }): Promise<MessageAttachment> {
    const mime = (params.mimeType || 'application/octet-stream').toLowerCase();
    if (!isAllowedMime(mime)) {
      throw new AppError(400, "This file type isn't supported.");
    }
    const max = maxBytesForMime(mime);
    if (params.buffer.length > max) {
      throw new AppError(400, 'This file is too large to upload.');
    }
    if (params.buffer.length === 0) {
      throw new AppError(400, 'Empty file.');
    }

    if (config.mediaStorage.provider === 'agrohub') {
      return this.saveAgrohubChatUpload(params, mime);
    }

    return this.saveLegacyDiskUpload(params, mime);
  }

  private async saveAgrohubChatUpload(
    params: {
      uploaderId: string;
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      width?: number;
      height?: number;
      conversationId?: string;
    },
    mime: string
  ): Promise<MessageAttachment> {
    const conversationId = String(params.conversationId || '').trim();
    if (!conversationId) {
      throw new AppError(
        400,
        'conversationId is required for media upload.',
        'CONVERSATION_ID_REQUIRED'
      );
    }

    const participant = await prisma.participant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: params.uploaderId },
      },
      select: { id: true },
    });
    if (!participant) {
      throw new AppError(403, 'Not a participant');
    }

    const safeName = sanitizeFileName(params.originalName);
    const uploaded = await agrohubStorage.uploadChatFile({
      conversationId,
      buffer: params.buffer,
      fileName: safeName,
      mimeType: mime,
    });

    if (!isAgrohubChatStorageKey(uploaded.storageKey)) {
      throw new AppError(502, 'Media storage returned an invalid key.', 'STORAGE_BAD_KEY');
    }
    if (!attachmentBelongsToConversation(uploaded.storageKey, conversationId)) {
      throw new AppError(502, 'Media storage returned an invalid key.', 'STORAGE_BAD_KEY');
    }

    const id = randomUUID();
    const kind = kindFromMime(mime);

    return {
      id,
      kind,
      mimeType: mime,
      fileName: safeName,
      fileSize: params.buffer.length,
      storageKey: uploaded.storageKey,
      url: proxyAttachmentUrl(uploaded.storageKey),
      width: params.width,
      height: params.height,
    };
  }

  private async saveLegacyDiskUpload(
    params: {
      uploaderId: string;
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      width?: number;
      height?: number;
    },
    mime: string
  ): Promise<MessageAttachment> {
    ensureUploadRoot();
    const id = randomUUID();
    const kind = kindFromMime(mime);
    const safeName = sanitizeFileName(params.originalName);
    const storageKey = `${params.uploaderId}/${id}-${safeName}`;
    const dest = resolveUploadPath(storageKey);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, params.buffer);

    return {
      id,
      kind,
      mimeType: mime,
      fileName: safeName,
      fileSize: params.buffer.length,
      storageKey,
      url: proxyAttachmentUrl(storageKey),
      width: params.width,
      height: params.height,
    };
  }

  /**
   * Persist a custom profile photo under profiles/{userId}/…
   * When PROFILE_STORAGE_PROVIDER=agrohub → Agrohub (storageType=profile).
   * Otherwise → local disk. Dual-read serving remains unchanged.
   */
  async saveProfileAvatar(params: {
    uploaderId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<{ storageKey: string; url: string; mimeType: string; fileSize: number }> {
    const mime = (params.mimeType || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime) && !mime.startsWith('image/')) {
      throw new AppError(400, 'Profile photos must be an image.');
    }
    if (params.buffer.length > UPLOAD_LIMITS.maxImageBytes) {
      throw new AppError(400, 'This file is too large to upload.');
    }
    if (params.buffer.length === 0) {
      throw new AppError(400, 'Empty file.');
    }

    if (config.profileStorage.provider === 'agrohub') {
      return this.saveAgrohubProfileAvatar(params, mime);
    }

    return this.saveLocalProfileAvatar(params, mime);
  }

  private async saveAgrohubProfileAvatar(
    params: {
      uploaderId: string;
      buffer: Buffer;
      originalName: string;
      mimeType: string;
    },
    mime: string
  ): Promise<{ storageKey: string; url: string; mimeType: string; fileSize: number }> {
    const userId = String(params.uploaderId || '').trim();
    if (!userId) {
      throw new AppError(400, 'Invalid user.');
    }

    const safeName = sanitizeFileName(params.originalName || 'avatar.jpg');
    const uploaded = await agrohubStorage.uploadProfileFile({
      userId,
      buffer: params.buffer,
      fileName: safeName,
      mimeType: mime,
    });

    if (!isValidProfileStorageKey(uploaded.storageKey, userId)) {
      throw new AppError(502, 'Media storage returned an invalid key.', 'STORAGE_BAD_KEY');
    }

    return {
      storageKey: uploaded.storageKey,
      url: proxyAttachmentUrl(uploaded.storageKey),
      mimeType: mime,
      fileSize: params.buffer.length,
    };
  }

  private saveLocalProfileAvatar(
    params: {
      uploaderId: string;
      buffer: Buffer;
      originalName: string;
      mimeType: string;
    },
    mime: string
  ): { storageKey: string; url: string; mimeType: string; fileSize: number } {
    ensureUploadRoot();
    const id = randomUUID();
    const safeName = sanitizeFileName(params.originalName || 'avatar.jpg');
    const storageKey = `profiles/${params.uploaderId}/${id}-${safeName}`;
    const dest = resolveUploadPath(storageKey);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, params.buffer);

    return {
      storageKey,
      url: proxyAttachmentUrl(storageKey),
      mimeType: mime,
      fileSize: params.buffer.length,
    };
  }

  async assertCanAccessFile(userId: string, storageKey: string): Promise<void> {
    // Owner chat uploads (legacy local keys)
    if (storageKey.startsWith(`${userId}/`)) return;

    // Profile photos: owner or any authenticated user who is not in a block relationship
    if (storageKey.startsWith('profiles/')) {
      const ownerId = storageKey.split('/')[1];
      if (!ownerId) throw new AppError(400, 'Invalid storage key');
      if (ownerId === userId) return;

      const blocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: ownerId },
            { blockerId: ownerId, blockedId: userId },
          ],
        },
        select: { id: true },
      });
      if (blocked) {
        throw new AppError(403, "You don't have permission to access this file.");
      }
      return;
    }

    // Agrohub chat keys: conversation participant who already has (or will have) the attachment
    // referenced on a message, OR participant of the conversationId embedded in the key
    // (needed briefly between upload and message create).
    if (isAgrohubChatStorageKey(storageKey)) {
      const parts = storageKey.replace(/\\/g, '/').split('/');
      // media/{conversationId}/… OR documents/{conversationId}/…
      const conversationId = parts[1];
      if (conversationId) {
        const participant = await prisma.participant.findUnique({
          where: {
            conversationId_userId: { conversationId, userId },
          },
          select: { id: true },
        });
        if (participant) return;
      }
    }

    const rows = await prisma.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok
      FROM messages m
      INNER JOIN participants p ON p.conversation_id = m.conversation_id
      WHERE p.user_id = ${userId}
        AND m.attachment IS NOT NULL
        AND (m.attachment->>'storageKey') = ${storageKey}
      LIMIT 1
    `;
    if (!rows.length) {
      throw new AppError(403, "You don't have permission to access this file.");
    }
  }

  /**
   * Existence check used by MessageService — no re-upload.
   * Dual-read: Agrohub chat keys → storage API; legacy → local disk.
   */
  async assertAttachmentBlobExists(
    storageKey: string,
    expectedSize?: number
  ): Promise<void> {
    if (isAgrohubChatStorageKey(storageKey)) {
      await agrohubStorage.assertObjectExists(storageKey);
      return;
    }

    // profiles/ dual-read: prefer local (current profile uploads), else Agrohub
    if (storageKey.startsWith('profiles/')) {
      if (localFileExists(storageKey)) {
        if (expectedSize != null) {
          const full = resolveUploadPath(storageKey);
          const stat = fs.statSync(full);
          if (stat.size !== expectedSize) {
            throw new AppError(400, 'Upload failed. Try again.');
          }
        }
        return;
      }
      await agrohubStorage.assertObjectExists(storageKey);
      return;
    }

    const full = resolveUploadPath(storageKey);
    if (!fs.existsSync(full)) {
      throw new AppError(400, 'Upload failed. Try again.');
    }
    if (expectedSize != null) {
      const stat = fs.statSync(full);
      if (stat.size !== expectedSize) {
        throw new AppError(400, 'Upload failed. Try again.');
      }
    }
  }

  getFileStream(storageKey: string) {
    const full = resolveUploadPath(storageKey);
    if (!fs.existsSync(full)) {
      throw new AppError(404, 'File not found');
    }
    const fileName = path.basename(full);
    return {
      stream: fs.createReadStream(full),
      size: fs.statSync(full).size,
      mimeType: mimeFromFileName(fileName),
      fileName,
    };
  }

  /**
   * Open a stored file for authenticated download.
   * Dual-read: local disk for legacy keys; Agrohub signed fetch for media/documents
   * (and profiles/ only when missing locally).
   */
  async openStoredFile(
    storageKey: string,
    rangeHeader?: string
  ): Promise<{
    stream: NodeJS.ReadableStream;
    statusCode: number;
    mimeType: string;
    fileName: string;
    size?: number;
    contentLength?: string;
    contentRange?: string;
    acceptRanges?: boolean;
  }> {
    // Dual-read:
    // - media/ + documents/ → Agrohub
    // - profiles/ → local if present (current profile uploads), else Agrohub
    // - everything else → local legacy
    const preferAgrohub =
      isAgrohubChatStorageKey(storageKey) ||
      (storageKey.startsWith('profiles/') && !localFileExists(storageKey));

    if (!preferAgrohub) {
      const local = this.getFileStream(storageKey);
      if (rangeHeader) {
        const ranged = this.openLocalRange(storageKey, local, rangeHeader);
        if (ranged) return ranged;
      }
      return {
        stream: local.stream,
        statusCode: 200,
        mimeType: local.mimeType,
        fileName: local.fileName,
        size: local.size,
        contentLength: String(local.size),
        acceptRanges: true,
      };
    }

    const remote = await agrohubStorage.fetchObject(storageKey, rangeHeader);
    if (!remote.body) {
      throw new AppError(502, 'Could not download media.');
    }
    const fileName = path.basename(storageKey) || 'file';
    return {
      stream: Readable.fromWeb(remote.body as import('stream/web').ReadableStream),
      statusCode: remote.status === 206 ? 206 : 200,
      mimeType: remote.contentType || mimeFromFileName(fileName),
      fileName,
      contentLength: remote.contentLength || undefined,
      contentRange: remote.contentRange || undefined,
      acceptRanges: true,
    };
  }

  private openLocalRange(
    storageKey: string,
    local: { stream: fs.ReadStream; size: number; mimeType: string; fileName: string },
    rangeHeader: string
  ) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) return null;
    const size = local.size;
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= size || start > end) {
      local.stream.destroy();
      throw new AppError(416, 'Requested range not satisfiable');
    }
    // Recreate stream with range — destroy unused full stream
    local.stream.destroy();
    const full = resolveUploadPath(storageKey);
    const stream = fs.createReadStream(full, { start, end });
    const chunkSize = end - start + 1;
    return {
      stream,
      statusCode: 206,
      mimeType: local.mimeType,
      fileName: local.fileName,
      size: chunkSize,
      contentLength: String(chunkSize),
      contentRange: `bytes ${start}-${end}/${size}`,
      acceptRanges: true,
    };
  }
}

export const uploadService = new UploadService();
