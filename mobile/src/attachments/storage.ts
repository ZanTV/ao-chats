/**
 * Device-local attachment download cache.
 * Paths stay on-device — never written to PostgreSQL.
 */

import { Platform } from 'react-native';
import { getSetting, setSetting } from '../services/storage';
import { getAccessToken } from '../services/storage';
import { getApiUrl } from '../services/config';
import type { MessageAttachment } from './types';

export type DownloadState = 'NOT_DOWNLOADED' | 'DOWNLOADING' | 'DOWNLOADED' | 'DOWNLOAD_FAILED';

export type LocalAttachmentRecord = {
  attachmentId: string;
  storageKey: string;
  localUri: string;
  fileSize: number;
  downloadedAt: string;
  mimeType: string;
  fileName: string;
};

type CacheIndex = Record<string, LocalAttachmentRecord>;

const CACHE_KEY = 'attachment_cache_v1';

type ProgressCb = (progress: number) => void;

const inFlight = new Map<string, Promise<LocalAttachmentRecord>>();

async function readIndex(): Promise<CacheIndex> {
  return (await getSetting<CacheIndex>(CACHE_KEY, {})) || {};
}

async function writeIndex(index: CacheIndex) {
  await setSetting(CACHE_KEY, index);
}

export async function getLocalAttachment(
  attachmentId: string
): Promise<LocalAttachmentRecord | null> {
  const index = await readIndex();
  const row = index[attachmentId];
  if (!row?.localUri) return null;

  if (Platform.OS === 'web') {
    return row;
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(row.localUri);
    if (!info.exists) {
      delete index[attachmentId];
      await writeIndex(index);
      return null;
    }
  } catch {
    return null;
  }
  return row;
}

function authenticatedDownloadUrl(attachment: MessageAttachment): string {
  const base = getApiUrl().replace(/\/$/, '');
  return `${base}/uploads/files/${encodeURIComponent(attachment.storageKey)}`;
}

async function downloadNative(
  attachment: MessageAttachment,
  onProgress?: ProgressCb,
  signal?: AbortSignal
): Promise<LocalAttachmentRecord> {
  const FileSystem = await import('expo-file-system/legacy');
  const token = await getAccessToken();
  if (!token) throw new Error("You don't have permission to upload this file.");

  const dir = `${FileSystem.cacheDirectory}ao-attachments/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const safeName = attachment.fileName.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120);
  const target = `${dir}${attachment.id}-${safeName}`;

  const url = authenticatedDownloadUrl(attachment);
  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    target,
    { headers: { Authorization: `Bearer ${token}` } },
    (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    }
  );

  if (signal) {
    signal.addEventListener('abort', () => {
      downloadResumable.pauseAsync().catch(() => {});
    });
  }

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) throw new Error('Download failed. Try again.');

  onProgress?.(1);
  return {
    attachmentId: attachment.id,
    storageKey: attachment.storageKey,
    localUri: result.uri,
    fileSize: attachment.fileSize,
    downloadedAt: new Date().toISOString(),
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
  };
}

async function downloadWeb(
  attachment: MessageAttachment,
  onProgress?: ProgressCb,
  signal?: AbortSignal
): Promise<LocalAttachmentRecord> {
  const token = await getAccessToken();
  if (!token) throw new Error("You don't have permission to upload this file.");

  const url = authenticatedDownloadUrl(attachment);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    throw new Error('Download failed. Try again.');
  }

  const total = Number(response.headers.get('content-length') || attachment.fileSize || 0);
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    onProgress?.(1);
    const localUri = URL.createObjectURL(blob);
    return {
      attachmentId: attachment.id,
      storageKey: attachment.storageKey,
      localUri,
      fileSize: blob.size,
      downloadedAt: new Date().toISOString(),
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) onProgress?.(Math.min(0.99, received / total));
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: attachment.mimeType });
  onProgress?.(1);
  const localUri = URL.createObjectURL(blob);
  return {
    attachmentId: attachment.id,
    storageKey: attachment.storageKey,
    localUri,
    fileSize: blob.size,
    downloadedAt: new Date().toISOString(),
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
  };
}

export async function seedLocalAttachment(record: LocalAttachmentRecord): Promise<void> {
  const index = await readIndex();
  index[record.attachmentId] = record;
  await writeIndex(index);
}

export async function ensureLocalAttachment(
  attachment: MessageAttachment,
  onProgress?: ProgressCb,
  signal?: AbortSignal
): Promise<LocalAttachmentRecord> {
  const existing = await getLocalAttachment(attachment.id);
  if (existing) {
    onProgress?.(1);
    return existing;
  }

  const pending = inFlight.get(attachment.id);
  if (pending) return pending;

  const job = (async () => {
    try {
      const record =
        Platform.OS === 'web'
          ? await downloadWeb(attachment, onProgress, signal)
          : await downloadNative(attachment, onProgress, signal);
      const index = await readIndex();
      index[attachment.id] = record;
      await writeIndex(index);
      return record;
    } finally {
      inFlight.delete(attachment.id);
    }
  })();

  inFlight.set(attachment.id, job);
  return job;
}
