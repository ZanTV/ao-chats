import type { PendingAttachment } from './pending';
import { getAccessToken } from '../services/storage';
import { getApiUrl } from '../services/config';
import { ApiError, formatApiError } from '../utils/validation';
import type { User } from '../stores/authStore';

/**
 * Upload custom profile photo to POST /users/me/avatar.
 */
export function uploadProfileAvatar(
  file: PendingAttachment,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<User> {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        reject(new ApiError("You don't have permission to upload this file.", 'UNAUTHORIZED'));
        return;
      }

      const xhr = new XMLHttpRequest();
      const url = `${getApiUrl().replace(/\/$/, '')}/users/me/avatar`;

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
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        signal?.removeEventListener('abort', abort);
        const status = xhr.status;
        const body = (xhr.response || {}) as Record<string, unknown>;
        if (status >= 200 && status < 300) {
          onProgress?.(100);
          resolve(body as unknown as User);
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

      const form = new FormData();
      const isWeb = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { Platform } = require('react-native') as { Platform: { OS: string } };
          return Platform.OS === 'web';
        } catch {
          return typeof document !== 'undefined';
        }
      })();

      if (isWeb) {
        fetch(file.localUri)
          .then((r) => r.blob())
          .then((blob) => {
            form.append('file', blob, file.fileName);
            xhr.send(form);
          })
          .catch(() => reject(new ApiError('Upload failed. Try again.', 'NETWORK_ERROR')));
        return;
      }

      form.append('file', {
        uri: file.localUri,
        name: file.fileName,
        type: file.mimeType,
      } as unknown as Blob);
      xhr.send(form);
    } catch (err) {
      reject(err instanceof Error ? err : new ApiError('Upload failed. Try again.', 'UPLOAD_FAILED'));
    }
  });
}
