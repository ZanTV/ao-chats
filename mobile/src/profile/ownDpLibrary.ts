import { Platform } from 'react-native';
import { getSetting, setSetting } from '../services/storage';
import type { PendingAttachment } from '../attachments/pending';
import { kindFromMimeClient, validatePendingAttachment } from '../attachments/pending';

export type OwnDpItem = {
  id: string;
  localUri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  createdAt: string;
};

const LIBRARY_KEY = 'own_dp_library_v1';
const MAX_OWN_DPS = 24;

function newId(): string {
  return `dp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persistUri(sourceUri: string, id: string): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const dir = `${FileSystem.documentDirectory || ''}own-dp/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const ext = sourceUri.split('?')[0].split('.').pop()?.toLowerCase();
    const safeExt = ext && ext.length <= 5 ? ext : 'jpg';
    const dest = `${dir}${id}.${safeExt}`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch {
    return sourceUri;
  }
}

export async function loadOwnDpLibrary(): Promise<OwnDpItem[]> {
  const list = await getSetting<OwnDpItem[]>(LIBRARY_KEY, []);
  return Array.isArray(list) ? list : [];
}

async function saveLibrary(list: OwnDpItem[]): Promise<OwnDpItem[]> {
  const next = list.slice(0, MAX_OWN_DPS);
  await setSetting(LIBRARY_KEY, next);
  return next;
}

export async function addOwnDpFromAssets(
  assets: Array<{
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    width?: number;
    height?: number;
  }>
): Promise<OwnDpItem[]> {
  const current = await loadOwnDpLibrary();
  const added: OwnDpItem[] = [];

  for (const asset of assets) {
    if (current.length + added.length >= MAX_OWN_DPS) break;
    const mime = asset.mimeType || 'image/jpeg';
    const pending: PendingAttachment = {
      localUri: asset.uri,
      mimeType: mime,
      fileName: asset.fileName || 'avatar.jpg',
      fileSize: asset.fileSize || 0,
      kind: kindFromMimeClient(mime),
      width: asset.width,
      height: asset.height,
      previewUri: asset.uri,
    };
    const err = validatePendingAttachment(pending);
    if (err) continue;

    const id = newId();
    const localUri = await persistUri(asset.uri, id);
    added.push({
      id,
      localUri,
      mimeType: mime,
      fileName: pending.fileName,
      fileSize: pending.fileSize,
      width: asset.width,
      height: asset.height,
      createdAt: new Date().toISOString(),
    });
  }

  if (added.length === 0) return current;
  return saveLibrary([...added, ...current]);
}

export async function removeOwnDpItem(id: string): Promise<OwnDpItem[]> {
  const current = await loadOwnDpLibrary();
  const target = current.find((i) => i.id === id);
  const next = current.filter((i) => i.id !== id);
  if (target && Platform.OS !== 'web') {
    try {
      const FileSystem = await import('expo-file-system/legacy');
      if (target.localUri.includes('/own-dp/')) {
        await FileSystem.deleteAsync(target.localUri, { idempotent: true });
      }
    } catch {
      // ignore
    }
  }
  return saveLibrary(next);
}

export function ownDpToPending(item: OwnDpItem): PendingAttachment {
  return {
    localUri: item.localUri,
    mimeType: item.mimeType,
    fileName: item.fileName,
    fileSize: item.fileSize,
    kind: 'image',
    width: item.width,
    height: item.height,
    previewUri: item.localUri,
  };
}
