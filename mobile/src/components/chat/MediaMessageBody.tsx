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
import type { MessageAttachment } from '../../attachments/types';
import { formatFileSize } from '../../attachments/types';
import {
  ensureLocalAttachment,
  getLocalAttachment,
  type DownloadState,
} from '../../attachments/storage';
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
  };
  /** Reserved for AO Media Viewer V2 */
  onOpenViewer?: (attachment: MessageAttachment) => void;
  renderCaption?: (caption: string) => React.ReactNode;
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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      const local = await getLocalAttachment(attachment.id);
      if (cancelled) return;
      if (local) {
        setLocalUri(local.localUri);
        setState('DOWNLOADED');
        setProgress(1);
        return;
      }
      // Auto-fetch images for inline preview; docs/videos wait for tap.
      if (attachment.kind === 'image') {
        setState('DOWNLOADING');
        try {
          const record = await ensureLocalAttachment(
            attachment,
            (p) => {
              if (!cancelled) setProgress(p);
            },
            controller.signal
          );
          if (cancelled) return;
          setLocalUri(record.localUri);
          setState('DOWNLOADED');
          setProgress(1);
        } catch {
          if (!cancelled) setState('DOWNLOAD_FAILED');
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attachment]);

  const startDownload = useCallback(async () => {
    setState('DOWNLOADING');
    setProgress(0);
    try {
      const record = await ensureLocalAttachment(attachment, (p) => setProgress(p));
      setLocalUri(record.localUri);
      setState('DOWNLOADED');
      setProgress(1);
    } catch {
      setState('DOWNLOAD_FAILED');
    }
  }, [attachment]);

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

  if (attachment.kind === 'image') {
    const canShow = Boolean(localUri);
    return (
      <View style={styles.mediaWrap}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (onOpenViewer) {
              openLocal();
              return;
            }
            if (state === 'DOWNLOADED') openLocal();
            else if (state !== 'DOWNLOADING') startDownload();
          }}
        >
          {canShow ? (
            <Image source={{ uri: localUri! }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: isOwn ? 'rgba(0,0,0,0.2)' : surfaceColor }]}>
              {state === 'DOWNLOADING' ? (
                <Text style={{ color: textColor, fontWeight: '700' }}>{Math.round(progress * 100)}%</Text>
              ) : (
                <Ionicons name="image-outline" size={28} color={mutedColor} />
              )}
              {state === 'DOWNLOAD_FAILED' && (
                <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 6 }}>{labels.retry}</Text>
              )}
              {state === 'NOT_DOWNLOADED' && (
                <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 6 }}>{labels.download}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
        {!!caption?.trim() && (
          <View style={styles.captionWrap}>
            {renderCaption ? renderCaption(caption) : (
              <Text style={{ color: textColor, fontSize: fonts.md }}>{caption}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  if (attachment.kind === 'video') {
    return (
      <View style={styles.mediaWrap}>
        <TouchableOpacity
          style={[styles.videoPlaceholder, { backgroundColor: isOwn ? 'rgba(0,0,0,0.25)' : surfaceColor }]}
          activeOpacity={0.85}
          onPress={() => {
            if (onOpenViewer) openLocal();
            else if (state === 'DOWNLOADED') openLocal();
            else startDownload();
          }}
        >
          <Ionicons name="play-circle" size={48} color={textColor} />
          <Text style={{ color: mutedColor, fontSize: fonts.xs, marginTop: 6 }}>
            {attachment.fileName}
          </Text>
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
        {!!caption?.trim() && (
          <View style={styles.captionWrap}>
            {renderCaption ? renderCaption(caption) : (
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
          else if (state === 'DOWNLOADED') openLocal();
          else startDownload();
        }}
      >
        <View style={[styles.docIcon, { backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : surfaceColor }]}>
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
            {attachment.mimeType.split('/').pop()?.toUpperCase() || 'FILE'} · {formatFileSize(attachment.fileSize)}
          </Text>
          {state === 'DOWNLOADING' && (
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: primaryColor }]} />
            </View>
          )}
          {state === 'DOWNLOAD_FAILED' && (
            <Text style={{ color: primaryColor, fontSize: fonts.xs, marginTop: 4 }}>{labels.downloadFailed}</Text>
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
          {renderCaption ? renderCaption(caption) : (
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
  },
  progressOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  progressText: {
    color: '#fff',
    fontWeight: '700',
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
