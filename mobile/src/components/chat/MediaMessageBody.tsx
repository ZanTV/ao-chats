import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { MessageAttachment } from '../../attachments/types';
import { formatFileSize } from '../../attachments/types';
import {
  ensureLocalAttachment,
  getLocalAttachment,
  invalidateLocalAttachment,
  resolveAttachmentUrl,
  type DownloadState,
} from '../../attachments/storage';
import { getAccessToken } from '../../services/storage';
import { BorderRadius, Spacing } from '../../theme';

interface Props {
  attachment: MessageAttachment;
  caption?: string;
  isOwn: boolean;
  textColor: string;
  mutedColor: string;
  surfaceColor: string;
  primaryColor: string;
  fonts: { xs: number; sm: number; md: number };
  labels: {
    download: string;
    downloading: string;
    downloadFailed: string;
    retry: string;
    open: string;
    unavailable?: string;
  };
  onOpenViewer?: (attachment: MessageAttachment) => void;
  renderCaption?: (caption: string) => React.ReactNode;
}

function formatDuration(seconds?: number): string {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return '';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function documentIcon(mime: string, fileName: string): keyof typeof Ionicons.glyphMap {
  const m = mime.toLowerCase();
  const n = fileName.toLowerCase();
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'document-text-outline';
  if (
    m.includes('word') ||
    m.includes('msword') ||
    n.endsWith('.doc') ||
    n.endsWith('.docx')
  ) {
    return 'document-outline';
  }
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx')) {
    return 'grid-outline';
  }
  if (
    m.includes('presentation') ||
    m.includes('powerpoint') ||
    n.endsWith('.ppt') ||
    n.endsWith('.pptx')
  ) {
    return 'easel-outline';
  }
  if (m.startsWith('text/') || n.endsWith('.txt') || n.endsWith('.csv')) return 'reader-outline';
  if (m.includes('zip') || n.endsWith('.zip')) return 'archive-outline';
  return 'document-attach-outline';
}

function documentTypeLabel(mime: string, fileName: string): string {
  const m = mime.toLowerCase();
  const n = fileName.toLowerCase();
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'PDF';
  if (n.endsWith('.docx') || m.includes('wordprocessingml')) return 'DOCX';
  if (n.endsWith('.doc') || m === 'application/msword') return 'DOC';
  if (n.endsWith('.xlsx') || m.includes('spreadsheetml')) return 'XLSX';
  if (n.endsWith('.xls')) return 'XLS';
  if (n.endsWith('.pptx') || m.includes('presentationml')) return 'PPTX';
  if (n.endsWith('.ppt')) return 'PPT';
  if (n.endsWith('.csv')) return 'CSV';
  if (n.endsWith('.txt') || m === 'text/plain') return 'TXT';
  if (n.endsWith('.zip') || m.includes('zip')) return 'ZIP';
  return mime.split('/').pop()?.toUpperCase() || 'FILE';
}

function WebVideoPreview({
  uri,
  width,
  height,
  onPress,
  durationLabel,
}: {
  uri: string;
  width: number;
  height: number;
  onPress: () => void;
  durationLabel: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width, height, borderRadius: BorderRadius.md, overflow: 'hidden', backgroundColor: '#111' }}
    >
      {/* RN Web: native video element shows a real frame without inventing thumbnails */}
      {React.createElement('video', {
        src: uri,
        muted: true,
        playsInline: true,
        preload: 'metadata',
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        },
      })}
      <View style={styles.videoPlayOverlay} pointerEvents="none">
        <Ionicons name="play-circle" size={48} color="#fff" />
      </View>
      {!!durationLabel && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function NativeVideoPreview({
  attachment,
  width,
  height,
  onPress,
  durationLabel,
}: {
  attachment: MessageAttachment;
  width: number;
  height: number;
  onPress: () => void;
  durationLabel: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((t) => {
        if (!cancelled) setToken(t);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.id]);

  const source = useMemo(
    () =>
      token && !failed
        ? {
            uri: resolveAttachmentUrl(attachment),
            headers: { Authorization: `Bearer ${token}` },
          }
        : '',
    [token, failed, attachment]
  );

  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' || error) setFailed(true);
    });
    return () => sub.remove();
  }, [player]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width, height, borderRadius: BorderRadius.md, overflow: 'hidden', backgroundColor: '#111' }}
    >
      {token && !failed ? (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {failed ? (
            <Ionicons name="videocam-outline" size={36} color="#fff" />
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>
      )}
      <View style={styles.videoPlayOverlay} pointerEvents="none">
        <Ionicons name="play-circle" size={48} color="#fff" />
      </View>
      {!!durationLabel && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function MediaMessageBody({
  attachment,
  caption,
  isOwn,
  textColor,
  mutedColor,
  surfaceColor,
  primaryColor,
  fonts,
  labels,
  onOpenViewer,
  renderCaption,
}: Props) {
  const [state, setState] = useState<DownloadState>('NOT_DOWNLOADED');
  const [progress, setProgress] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  const attachmentId = attachment.id;
  const storageKey = attachment.storageKey;
  const kind = attachment.kind;
  const durationLabel = formatDuration(attachment.duration);

  const loadMedia = useCallback(
    async (signal?: AbortSignal, force = false) => {
      if (force) {
        await invalidateLocalAttachment(attachmentId);
        setLocalUri(null);
        setImageBroken(false);
      }

      const local = await getLocalAttachment(attachmentId, storageKey);
      if (signal?.aborted) return;
      if (local?.localUri) {
        setLocalUri(local.localUri);
        setState('DOWNLOADED');
        setProgress(1);
        return;
      }

      // Native video: stream preview without full download.
      if (kind === 'video' && Platform.OS !== 'web') {
        setState('DOWNLOADED');
        return;
      }

      setState('DOWNLOADING');
      try {
        const record = await ensureLocalAttachment(
          attachment,
          (p) => {
            if (!signal?.aborted) setProgress(p);
          },
          signal
        );
        if (signal?.aborted) return;
        setLocalUri(record.localUri);
        setState('DOWNLOADED');
        setProgress(1);
        setImageBroken(false);
      } catch {
        if (!signal?.aborted) setState('DOWNLOAD_FAILED');
      }
    },
    // Intentionally stable keys — avoid abort loops from new attachment object refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachmentId, storageKey, kind]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadMedia(controller.signal);
    return () => controller.abort();
  }, [loadMedia]);

  const startDownload = useCallback(async () => {
    await loadMedia(undefined, true);
  }, [loadMedia]);

  const openLocal = useCallback(async () => {
    if (onOpenViewer) {
      onOpenViewer(attachment);
      return;
    }
    const uri = localUri;
    if (!uri) {
      await startDownload();
      return;
    }
    if (Platform.OS === 'web') {
      window.open(uri, '_blank');
      return;
    }
    Linking.openURL(uri).catch(() => {});
  }, [attachment, localUri, onOpenViewer, startDownload]);

  const handleImageError = useCallback(() => {
    setImageBroken(true);
    void startDownload();
  }, [startDownload]);

  const captionNode = !!caption?.trim() && (
    <View style={styles.captionWrap}>
      {renderCaption ? (
        renderCaption(caption)
      ) : (
        <Text style={{ color: textColor, fontSize: fonts.md }}>{caption}</Text>
      )}
    </View>
  );

  if (kind === 'image') {
    const canShow = Boolean(localUri) && !imageBroken && state === 'DOWNLOADED';
    return (
      <View style={styles.mediaWrap}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (onOpenViewer) openLocal();
            else if (state === 'DOWNLOADED' && canShow) openLocal();
            else if (state !== 'DOWNLOADING') startDownload();
          }}
        >
          {canShow ? (
            <Image
              source={{ uri: localUri! }}
              style={styles.image}
              resizeMode="cover"
              onError={handleImageError}
            />
          ) : (
            <View
              style={[
                styles.image,
                styles.imagePlaceholder,
                { backgroundColor: isOwn ? 'rgba(0,0,0,0.2)' : surfaceColor },
              ]}
            >
              {state === 'DOWNLOADING' ? (
                <>
                  <ActivityIndicator color={primaryColor} />
                  <Text style={{ color: textColor, fontWeight: '700', marginTop: 8 }}>
                    {Math.round(progress * 100)}%
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="image-outline" size={28} color={mutedColor} />
                  <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 6 }}>
                    {state === 'DOWNLOAD_FAILED' ? labels.retry : labels.download}
                  </Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
        {captionNode}
      </View>
    );
  }

  if (kind === 'video') {
    const useStreamingPreview = Platform.OS !== 'web';
    const webReady = Platform.OS === 'web' && localUri && state === 'DOWNLOADED';

    return (
      <View style={styles.mediaWrap}>
        {useStreamingPreview ? (
          <NativeVideoPreview
            attachment={attachment}
            width={240}
            height={160}
            durationLabel={durationLabel}
            onPress={() => openLocal()}
          />
        ) : webReady ? (
          <WebVideoPreview
            uri={localUri!}
            width={240}
            height={160}
            durationLabel={durationLabel}
            onPress={() => openLocal()}
          />
        ) : (
          <TouchableOpacity
            style={[
              styles.videoPlaceholder,
              { backgroundColor: isOwn ? 'rgba(0,0,0,0.25)' : surfaceColor },
            ]}
            activeOpacity={0.85}
            onPress={() => {
              if (state !== 'DOWNLOADING') startDownload();
            }}
          >
            {state === 'DOWNLOADING' ? (
              <>
                <ActivityIndicator color={primaryColor} />
                <Text style={{ color: textColor, fontSize: fonts.sm, marginTop: 8 }}>
                  {labels.downloading} {Math.round(progress * 100)}%
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="play-circle" size={48} color={textColor} />
                <Text style={{ color: primaryColor, fontSize: fonts.sm, marginTop: 8 }}>
                  {state === 'DOWNLOAD_FAILED' ? labels.retry : labels.download}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        <Text
          style={{ color: mutedColor, fontSize: fonts.xs, marginTop: 4, paddingHorizontal: 2 }}
          numberOfLines={1}
        >
          {attachment.fileName}
        </Text>
        {captionNode}
      </View>
    );
  }

  const docIcon = documentIcon(attachment.mimeType, attachment.fileName);
  const typeLabel = documentTypeLabel(attachment.mimeType, attachment.fileName);

  return (
    <View style={styles.docWrap}>
      <TouchableOpacity
        style={styles.docRow}
        activeOpacity={0.8}
        onPress={() => {
          if (onOpenViewer) openLocal();
          else if (state === 'DOWNLOADED' && localUri) openLocal();
          else startDownload();
        }}
      >
        <View
          style={[styles.docIcon, { backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : surfaceColor }]}
        >
          {state === 'DOWNLOADING' ? (
            <ActivityIndicator color={primaryColor} />
          ) : (
            <Ionicons name={docIcon} size={22} color={textColor} />
          )}
        </View>
        <View style={styles.docMeta}>
          <Text style={{ color: textColor, fontSize: fonts.sm, fontWeight: '600' }} numberOfLines={2}>
            {attachment.fileName}
          </Text>
          <Text style={{ color: mutedColor, fontSize: fonts.xs, marginTop: 2 }}>
            {typeLabel} · {formatFileSize(attachment.fileSize)}
          </Text>
          {state === 'DOWNLOADING' && (
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.round(progress * 100)}%`, backgroundColor: primaryColor },
                ]}
              />
            </View>
          )}
          {state === 'DOWNLOAD_FAILED' && (
            <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 4 }}>
              {labels.downloadFailed} · {labels.retry}
            </Text>
          )}
          {state === 'NOT_DOWNLOADED' && (
            <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 4 }}>{labels.download}</Text>
          )}
          {state === 'DOWNLOADED' && (
            <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 4 }}>{labels.open}</Text>
          )}
        </View>
      </TouchableOpacity>
      {captionNode}
    </View>
  );
}

const styles = StyleSheet.create({
  mediaWrap: {
    overflow: 'hidden',
    borderRadius: BorderRadius.md,
    marginBottom: 4,
  },
  image: {
    width: 240,
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    width: 240,
    height: 160,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    overflow: 'hidden',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  durationBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    marginTop: Spacing.sm,
  },
  docWrap: {
    minWidth: 220,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docMeta: {
    flex: 1,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(127,127,127,0.25)',
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});
