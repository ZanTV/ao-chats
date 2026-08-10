import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MessageAttachment } from '../attachments/types';
import { formatFileSize } from '../attachments/types';
import { ensureLocalAttachment, getLocalAttachment, invalidateLocalAttachment } from '../attachments/storage';
import { BorderRadius, Spacing } from '../theme';

type Props = {
  attachment: MessageAttachment;
  createdAt: string;
  tileSize: number;
  colors: {
    surface: string;
    surfaceSecondary: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    primary: string;
    border: string;
  };
  fonts: { xs: number; sm: number; md: number };
  sharedOnLabel: string;
  onPress: () => void;
};

/**
 * Visible shared-media preview — uses local attachment cache (same as chat bubbles)
 * so authenticated remote URLs are never rendered as blank tiles.
 */
export function SharedMediaPreview({
  attachment,
  createdAt,
  tileSize,
  colors,
  fonts,
  sharedOnLabel,
  onPress,
}: Props) {
  const kind = attachment.kind;
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(kind === 'image');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      if (kind === 'document') {
        setLoading(false);
        return;
      }

      try {
        const cached = await getLocalAttachment(attachment.id, attachment.storageKey);
        if (cancelled) return;
        if (cached?.localUri) {
          setLocalUri(cached.localUri);
          setLoading(false);
          return;
        }

        if (kind === 'image') {
          setLoading(true);
          const record = await ensureLocalAttachment(
            attachment,
            undefined,
            controller.signal
          );
          if (cancelled) return;
          setLocalUri(record.localUri);
          setFailed(false);
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attachment, kind]);

  const formatSharedDate = () => {
    const d = new Date(createdAt);
    return `${sharedOnLabel} ${d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`;
  };

  if (kind === 'document') {
    const ext = (attachment.fileName || '').split('.').pop()?.toUpperCase() || 'FILE';
    return (
      <TouchableOpacity
        style={[styles.docRow, { borderBottomColor: colors.border }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[styles.docIcon, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="document-text-outline" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: fonts.md, fontWeight: '500' }} numberOfLines={1}>
            {attachment.fileName || 'Document'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, marginTop: 2 }}>
            {ext} · {formatFileSize(attachment.fileSize || 0)}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, marginTop: 2 }}>
            {formatSharedDate()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const showImage = kind === 'image' && Boolean(localUri) && !failed;

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        {
          width: tileSize,
          height: tileSize,
          backgroundColor: colors.surfaceSecondary,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {showImage ? (
        <Image
          source={{ uri: localUri! }}
          style={styles.tileImage}
          resizeMode="cover"
          onError={() => {
            setFailed(true);
            void invalidateLocalAttachment(attachment.id).then(() =>
              ensureLocalAttachment(attachment)
                .then((record) => {
                  setLocalUri(record.localUri);
                  setFailed(false);
                })
                .catch(() => setFailed(true))
            );
          }}
        />
      ) : loading ? (
        <View style={[styles.tileImage, styles.center]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={[styles.tileImage, styles.center]}>
          <Ionicons
            name={kind === 'video' ? 'videocam' : 'image-outline'}
            size={28}
            color={colors.textTertiary}
          />
        </View>
      )}
      {kind === 'video' ? (
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      ) : null}
      {typeof attachment.duration === 'number' && attachment.duration > 0 ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(attachment.duration)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    borderRadius: BorderRadius.sm,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
