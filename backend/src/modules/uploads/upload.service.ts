import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../config/database';
import {
  kindFromMime,
  maxBytesForMime,
  isAllowedMime,
  sanitizeFileName,
  type MessageAttachment,
} from '../../utils/attachment';

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

export class UploadService {
  async saveLocalUpload(params: {
    uploaderId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    width?: number;
    height?: number;
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

    ensureUploadRoot();
    const id = randomUUID();
    const kind = kindFromMime(mime);
    const safeName = sanitizeFileName(params.originalName);
    const storageKey = `${params.uploaderId}/${id}-${safeName}`;
    const dest = resolveUploadPath(storageKey);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, params.buffer);

    const publicPath = `/api/uploads/files/${encodeURIComponent(storageKey)}`;
    const base = config.apiUrl.replace(/\/$/, '');

    return {
      id,
      kind,
      mimeType: mime,
      fileName: safeName,
      fileSize: params.buffer.length,
      storageKey,
      url: `${base}${publicPath}`,
      width: params.width,
      height: params.height,
    };
  }

  async assertCanAccessFile(userId: string, storageKey: string): Promise<void> {
    // Owner path prefix OR participant in a message that references this key
    if (storageKey.startsWith(`${userId}/`)) return;

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

  getFileStream(storageKey: string) {
    const full = resolveUploadPath(storageKey);
    if (!fs.existsSync(full)) {
      throw new AppError(404, 'File not found');
    }
    const fileName = path.basename(full);
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
    return {
      stream: fs.createReadStream(full),
      size: fs.statSync(full).size,
      mimeType: mimeByExt[ext] || 'application/octet-stream',
      fileName,
    };
  }
}

export const uploadService = new UploadService();
