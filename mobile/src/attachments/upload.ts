import type { MessageAttachment } from './types';
import { getAccessToken } from '../services/storage';
import { getApiUrl } from '../services/config';
import { ApiError, formatApiError } from '../utils/validation';
import type { PendingAttachment } from './pending';

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

/**
 * Multipart upload with real XHR progress (fetch cannot report upload %).
 */
export function uploadAttachment(
  file: PendingAttachment,
  conversationId: string,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal
): Promise<MessageAttachment> {
  return new Promise(async (resolve, reject) => {
    try {
      const convId = conversationId.trim();
      if (!convId) {
        reject(new ApiError('Upload failed. Try again.', 'INVALID_CONVERSATION'));
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        reject(new ApiError("You don't have permission to upload this file.", 'UNAUTHORIZED'));
        return;
      }

      const xhr = new XMLHttpRequest();
      const url = `${getApiUrl().replace(/\/$/, '')}/uploads`;

      const abort = () => {
        xhr.abort();
        reject(new ApiError('Upload cancelled', 'CANCELLED'));
      };
      signal?.addEventListener('abort', abort);

      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.responseType = 'json';

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress?.({ loaded: event.loaded, total: event.total, percent });
      };

      xhr.onload = () => {
        signal?.removeEventListener('abort', abort);
        const status = xhr.status;
        const body = (xhr.response || {}) as Record<string, unknown>;
        if (status >= 200 && status < 300) {
          const attachment = (body.attachment || body) as MessageAttachment;
          if (!attachment?.id || !attachment?.storageKey) {
            reject(new ApiError('Upload failed. Try again.', 'INVALID_RESPONSE'));
            return;
          }
          onProgress?.({
            loaded: file.fileSize,
            total: file.fileSize,
            percent: 100,
          });
          resolve(attachment);
          return;
        }
        const message = formatApiError(body) || 'Upload failed. Try again.';
        reject(new ApiError(message, status === 413 ? 'PAYLOAD_TOO_LARGE' : 'UPLOAD_FAILED', status));
      };

      xhr.onerror = () => {
        signal?.removeEventListener('abort', abort);
        reject(new ApiError('Upload failed. Try again.', 'NETWORK_ERROR'));
      };

      xhr.onabort = () => {
        signal?.removeEventListener('abort', abort);
        reject(new ApiError('Upload cancelled', 'CANCELLED'));
      };

      const appendMetaFields = (form: FormData) => {
        form.append('conversationId', convId);
        if (file.width) form.append('width', String(file.width));
        if (file.height) form.append('height', String(file.height));
      };

      const form = new FormData();
      const blobPart: any = {
        uri: file.localUri,
        name: file.fileName,
        type: file.mimeType,
      };
      if (PlatformIsWeb()) {
        // Web: fetch the blob from the object URL / File
        fetch(file.localUri)
          .then((r) => r.blob())
          .then((blob) => {
            form.append('file', blob, file.fileName);
            appendMetaFields(form);
            xhr.send(form);
          })
          .catch(() => reject(new ApiError('Upload failed. Try again.', 'NETWORK_ERROR')));
        return;
      }

      form.append('file', blobPart);
      appendMetaFields(form);
      xhr.send(form);
    } catch (err) {
      reject(err instanceof Error ? err : new ApiError('Upload failed. Try again.', 'UPLOAD_FAILED'));
    }
  });
}

function PlatformIsWeb() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native') as { Platform: { OS: string } };
    return Platform.OS === 'web';
  } catch {
    return typeof document !== 'undefined';
  }
}
