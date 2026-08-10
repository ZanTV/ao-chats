import React, { useCallback, useEffect, useState } from 'react';
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

function NativeVideoPreview({
  attachment,
  width,
  height,
  onPress,
}: {
  attachment: MessageAttachment;
  width: number;
  height: number;
  onPress: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getAccessToken().then(setToken).catch(() => setFailed(true));
  }, []);

  const source = token && !failed
    ? {
        uri: resolveAttachmentUrl(attachment),
        headers: { Authorization: `Bearer ${token}` },
      }
    : '';

  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') setFailed(true);
      if (error) setFailed(true);
    });
    return () => sub.remove();
  }, [player]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width, height, borderRadius: BorderRadius.md, overflow: 'hidden' }}
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
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <View style={styles.videoPlayOverlay} pointerEvents="none">
        <Ionicons name="play-circle" size={48} color="#fff" />
      </View>
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

  const loadMedia = useCallback(
    async (signal?: AbortSignal, force = false) => {
      if (force) {
        await invalidateLocalAttachment(attachment.id);
        setLocalUri(null);
        setImageBroken(false);
      }

      const local = await getLocalAttachment(attachment.id, attachment.storageKey);
      if (local?.localUri) {
        setLocalUri(local.localUri);
        setState('DOWNLOADED');
        setProgress(1);
        return;
      }

      if (attachment.kind === 'video' && Platform.OS !== 'web') {
        setState('DOWNLOADED');
        return;
      }

      setState('DOWNLOADING');
      try {
        const record = await ensureLocalAttachment(
          attachment,
          (p) => setProgress(p),
          signal
        );
        setLocalUri(record.localUri);
        setState('DOWNLOADED');
        setProgress(1);
        setImageBroken(false);
      } catch {
        setState('DOWNLOAD_FAILED');
      }
    },
    [attachment]
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

  if (attachment.kind === 'image') {
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
              ) : state === 'DOWNLOAD_FAILED' ? (
                <>
                  <Ionicons name="image-outline" size={28} color={mutedColor} />
                  <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 6 }}>
                    {labels.retry}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="image-outline" size={28} color={mutedColor} />
                  <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 6 }}>
                    {labels.download}
                  </Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
        {!!caption?.trim() && (
          <View style={styles.captionWrap}>
            {renderCaption ? (
              renderCaption(caption)
            ) : (
              <Text style={{ color: textColor, fontSize: fonts.md }}>{caption}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  if (attachment.kind === 'video') {
    const useStreamingPreview = Platform.OS !== 'web' && state !== 'DOWNLOAD_FAILED';

    return (
      <View style={styles.mediaWrap}>
        {useStreamingPreview ? (
          <NativeVideoPreview
            attachment={attachment}
            width={240}
            height={160}
            onPress={() => {
              if (onOpenViewer) openLocal();
              else if (localUri) openLocal();
              else startDownload();
            }}
          />
        ) : (
          <TouchableOpacity
            style={[
              styles.videoPlaceholder,
              { backgroundColor: isOwn ? 'rgba(0,0,0,0.25)' : surfaceColor },
            ]}
            activeOpacity={0.85}
            onPress={() => {
              if (onOpenViewer) openLocal();
              else if (state === 'DOWNLOADED' && localUri) openLocal();
              else startDownload();
            }}
          >
            {localUri && state === 'DOWNLOADED' && Platform.OS === 'web' ? (
              <View style={{ width: '100%', height: '100%' }}>
                <Ionicons name="play-circle" size={48} color={textColor} />
              </View>
            ) : (
              <Ionicons name="play-circle" size={48} color={textColor} />
            )}
            {state === 'DOWNLOADING' && (
              <Text style={{ color: textColor, fontSize: fonts.sm, marginTop: 8 }}>
                {labels.downloading} {Math.round(progress * 100)}%
              </Text>
            )}
            {state === 'NOT_DOWNLOADED' && (
              <Text style={{ color: primaryColor, fontSize: fonts.sm, marginTop: 8 }}>
                {labels.download}
              </Text>
            )}
            {state === 'DOWNLOAD_FAILED' && (
              <Text style={{ color: primaryColor, fontSize: fonts.sm, marginTop: 8 }}>
                {labels.retry}
              </Text>
            )}
          </TouchableOpacity>
        )}
        <Text
          style={{ color: mutedColor, fontSize: fonts.xs, marginTop: 4, paddingHorizontal: 2 }}
          numberOfLines={1}
        >
          {attachment.fileName}
          {attachment.duration ? ` · ${Math.round(attachment.duration)}s` : ''}
        </Text>
        {!!caption?.trim() && (
          <View style={styles.captionWrap}>
            {renderCaption ? (
              renderCaption(caption)
            ) : (
              <Text style={{ color: textColor, fontSize: fonts.md }}>{caption}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

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
            <Ionicons name="document-text-outline" size={22} color={textColor} />
          )}
        </View>
        <View style={styles.docMeta}>
          <Text style={{ color: textColor, fontSize: fonts.sm, fontWeight: '600' }} numberOfLines={2}>
            {attachment.fileName}
          </Text>
          <Text style={{ color: mutedColor, fontSize: fonts.xs, marginTop: 2 }}>
            {attachment.mimeType.split('/').pop()?.toUpperCase() || 'FILE'} ·{' '}
            {formatFileSize(attachment.fileSize)}
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
      {!!caption?.trim() && (
        <View style={styles.captionWrap}>
          {renderCaption ? (
            renderCaption(caption)
          ) : (
            <Text style={{ color: textColor, fontSize: fonts.md }}>{caption}</Text>
          )}
        </View>
      )}
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
