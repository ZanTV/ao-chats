/**
 * Backend-only client for https://storage.agrohub.ltd
 * Never expose STORAGE_API_SECRET or signed URLs to clients/logs.
 */
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';

export type AgrohubChatUploadResult = {
  storageKey: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
};

function storageBaseUrl(): string {
  return config.mediaStorage.apiUrl.replace(/\/$/, '');
}

function requireSecret(): string {
  const secret = config.mediaStorage.apiSecret;
  if (!secret) {
    throw new AppError(503, 'Media storage is not configured.', 'STORAGE_NOT_CONFIGURED');
  }
  return secret;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${requireSecret()}`,
    ...extra,
  };
}

function mapStorageHttpError(status: number, fallback: string): AppError {
  if (status === 401 || status === 403) {
    return new AppError(502, 'Media storage rejected the request.', 'STORAGE_AUTH');
  }
  if (status === 404) {
    return new AppError(400, 'Upload failed. Try again.', 'STORAGE_NOT_FOUND');
  }
  if (status >= 500) {
    return new AppError(502, 'Media storage is temporarily unavailable.', 'STORAGE_UPSTREAM');
  }
  return new AppError(502, fallback, 'STORAGE_ERROR');
}

async function readJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const data = obj.data;
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;
    for (const key of keys) {
      const value = nested[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  const data = obj.data;
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;
    for (const key of keys) {
      const value = nested[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    ((err as { name?: string }).name === 'AbortError' ||
      (err as { name?: string }).name === 'TimeoutError')
  );
}

async function storageFetch(url: string, init: RequestInit): Promise<Response> {
  const timeoutMs = config.mediaStorage.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new AppError(504, 'Media storage timed out. Try again.', 'STORAGE_TIMEOUT');
    }
    throw new AppError(502, 'Could not reach media storage. Try again.', 'STORAGE_NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

/** Chat media keys written by Agrohub (not legacy local `{userId}/…`). */
export function isAgrohubChatStorageKey(storageKey: string): boolean {
  const key = storageKey.replace(/\\/g, '/');
  return key.startsWith('media/') || key.startsWith('documents/');
}

/**
 * Keys that should be fetched from Agrohub when not present on local disk.
 * profiles/ may still be legacy local until profile integration; prefer local first.
 */
export function isAgrohubPrefixedKey(storageKey: string): boolean {
  const key = storageKey.replace(/\\/g, '/');
  return (
    key.startsWith('media/') ||
    key.startsWith('documents/') ||
    key.startsWith('profiles/')
  );
}

export function attachmentBelongsToConversation(
  storageKey: string,
  conversationId: string
): boolean {
  const key = storageKey.replace(/\\/g, '/');
  const id = conversationId.trim();
  if (!id) return false;
  return (
    key.startsWith(`media/${id}/`) ||
    key.startsWith(`documents/${id}/`)
  );
}

export class AgrohubStorageClient {
  async uploadChatFile(params: {
    conversationId: string;
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<AgrohubChatUploadResult> {
    const form = new FormData();
    const bytes = new Uint8Array(params.buffer);
    const blob = new Blob([bytes], { type: params.mimeType || 'application/octet-stream' });
    form.append('file', blob, params.fileName);
    form.append('storageType', 'chat');
    form.append('conversationId', params.conversationId);

    const res = await storageFetch(`${storageBaseUrl()}/api/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });

    const json = await readJsonSafe(res);
    if (!res.ok) {
      throw mapStorageHttpError(res.status, 'Upload failed. Try again.');
    }

    const storageKey = pickString(json, ['storageKey', 'key', 'path']);
    if (!storageKey) {
      throw new AppError(502, 'Media storage returned an invalid response.', 'STORAGE_BAD_RESPONSE');
    }

    return {
      storageKey,
      mimeType: pickString(json, ['mimeType', 'contentType', 'content_type']),
      fileName: pickString(json, ['fileName', 'filename', 'originalName']),
      fileSize: pickNumber(json, ['fileSize', 'size', 'bytes']),
    };
  }

  /**
   * Verify an object exists by requesting a short-lived signed URL (server-side only).
   * Does not log or return the signed URL to callers that might leak it.
   */
  async assertObjectExists(storageKey: string): Promise<void> {
    const signed = await this.createSignedUrl(storageKey);
    if (!signed) {
      throw new AppError(400, 'Upload failed. Try again.', 'STORAGE_NOT_FOUND');
    }
  }

  async createSignedUrl(storageKey: string): Promise<string | null> {
    const res = await storageFetch(`${storageBaseUrl()}/api/sign`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ storageKey }),
    });

    const json = await readJsonSafe(res);
    if (res.status === 404) return null;
    if (!res.ok) {
      if (res.status === 400 || res.status === 404) return null;
      throw mapStorageHttpError(res.status, 'Could not access media storage.');
    }

    const url = pickString(json, ['url', 'signedUrl', 'signed_url', 'downloadUrl', 'href']);
    return url || null;
  }

  /**
   * Fetch object bytes via signed URL. Forwards Range when provided.
   * Never returns the signed URL itself.
   */
  async fetchObject(
    storageKey: string,
    rangeHeader?: string
  ): Promise<{
    body: ReadableStream<Uint8Array> | null;
    status: number;
    headers: Headers;
    contentType: string | null;
    contentLength: string | null;
    contentRange: string | null;
  }> {
    const signedUrl = await this.createSignedUrl(storageKey);
    if (!signedUrl) {
      throw new AppError(404, 'File not found');
    }

    const headers: Record<string, string> = {};
    if (rangeHeader) headers.Range = rangeHeader;

    const res = await storageFetch(signedUrl, {
      method: 'GET',
      headers,
    });

    if (res.status === 404) {
      throw new AppError(404, 'File not found');
    }
    if (!res.ok && res.status !== 206) {
      throw mapStorageHttpError(res.status, 'Could not download media.');
    }

    return {
      body: res.body,
      status: res.status,
      headers: res.headers,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
      contentRange: res.headers.get('content-range'),
    };
  }
}

export const agrohubStorage = new AgrohubStorageClient();
