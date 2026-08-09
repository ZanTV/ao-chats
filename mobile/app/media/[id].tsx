import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as ScreenOrientation from 'expo-screen-orientation';
import { api } from '../../src/services/api';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';
import {
  MediaViewerHeader,
  AOImageViewer,
  AOVideoPlayer,
  AODocumentViewer,
} from '../../src/components/media';
import { ActionMenuSheet } from '../../src/components/ActionMenuSheet';
import type { MessageAttachment } from '../../src/attachments/types';
import { formatFileSize } from '../../src/attachments/types';
import {
  ensureLocalAttachment,
  buildMediaShareLink,
  saveAttachmentToDevice,
  shareAttachmentFile,
} from '../../src/attachments/storage';
import { ApiError } from '../../src/utils/validation';
import { Spacing } from '../../src/theme';

type MediaPayload = {
  attachment: MessageAttachment;
  messageId: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    avatarId: string;
  };
};

function formatWhen(iso: string, locale?: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time}`;
}

export default function MediaViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, colors, fonts, language } = useSettingsStore();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaPayload | null>(null);
  const [gallery, setGallery] = useState<MessageAttachment[]>([]);
  const [uriMap, setUriMap] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(id || null);
  const [dlProgress, setDlProgress] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const labels = t.media;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMedia(id);
      setMedia({
        ...res.media,
        createdAt: String(res.media.createdAt),
      });
      setGallery(res.gallery?.length ? res.gallery : [res.media.attachment]);
      setActiveId(res.media.attachment.id);

      const current = res.media.attachment;
      const record = await ensureLocalAttachment(current, (p) => setDlProgress(p));
      setUriMap((prev) => ({ ...prev, [current.id]: record.localUri }));

      // Prefetch nearby images lightly (max 2 neighbors)
      const idx = (res.gallery || []).findIndex((a) => a.id === current.id);
      const neighbors = (res.gallery || []).slice(Math.max(0, idx - 1), idx + 2);
      for (const item of neighbors) {
        if (item.id === current.id) continue;
        ensureLocalAttachment(item)
          .then((r) => setUriMap((prev) => ({ ...prev, [item.id]: r.localUri })))
          .catch(() => {});
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : labels.unavailable;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, labels.unavailable]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const activeAttachment = useMemo(() => {
    if (!gallery.length) return media?.attachment || null;
    return gallery.find((a) => a.id === activeId) || media?.attachment || null;
  }, [gallery, activeId, media]);

  const imageItems = useMemo(() => {
    return gallery
      .filter((a) => a.kind === 'image' && uriMap[a.id])
      .map((a) => ({ attachment: a, uri: uriMap[a.id] }));
  }, [gallery, uriMap]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 1600);
  };

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else if (media?.conversationId) router.replace(`/chat/${media.conversationId}`);
    else router.replace('/(tabs)');
  };

  const ensureActiveUri = async () => {
    if (!activeAttachment) return null;
    if (uriMap[activeAttachment.id]) return uriMap[activeAttachment.id];
    const record = await ensureLocalAttachment(activeAttachment, (p) => setDlProgress(p));
    setUriMap((prev) => ({ ...prev, [activeAttachment.id]: record.localUri }));
    return record.localUri;
  };

  const actionItems = [
    {
      key: 'save',
      label: labels.saveToDevice,
      onPress: async () => {
        try {
          const uri = await ensureActiveUri();
          if (!uri || !activeAttachment) return;
          await saveAttachmentToDevice(uri, activeAttachment);
          showToast(labels.saved);
        } catch (err) {
          showToast(err instanceof Error ? err.message : labels.saveFailed);
        }
      },
    },
    {
      key: 'share',
      label: labels.share,
      onPress: async () => {
        try {
          const uri = await ensureActiveUri();
          if (!uri || !activeAttachment) return;
          await shareAttachmentFile(uri, activeAttachment);
        } catch {
          showToast(labels.shareFailed);
        }
      },
    },
    {
      key: 'copy',
      label: labels.copyLink,
      onPress: async () => {
        if (!activeAttachment) return;
        await Clipboard.setStringAsync(buildMediaShareLink(activeAttachment.id));
        showToast(labels.linkCopied);
      },
    },
  ];

  const immersive = activeAttachment?.kind === 'image' || activeAttachment?.kind === 'video';
  const shellBg = immersive ? '#000' : colors.background;
  const headerColors = immersive
    ? {
        text: '#FFFFFF',
        textSecondary: 'rgba(255,255,255,0.72)',
        surface: 'rgba(0,0,0,0.72)',
        border: 'rgba(255,255,255,0.12)',
      }
    : {
        text: colors.text,
        textSecondary: colors.textSecondary,
        surface: colors.surface,
        border: colors.border,
      };

  const senderName = media
    ? media.sender.id === user?.id
      ? t.chat.you
      : `${media.sender.firstName} ${media.sender.lastName}`.trim()
    : '';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: shellBg }]} edges={['top', 'left', 'right']}>
      <MediaViewerHeader
        title={senderName || labels.title}
        subtitle={
          media
            ? `${formatWhen(media.createdAt, language === 'sw' ? 'sw-TZ' : undefined)}${
                activeAttachment ? ` · ${formatFileSize(activeAttachment.fileSize)}` : ''
              }`
            : undefined
        }
        avatarId={media?.sender.avatarId}
        onBack={onBack}
        onMore={() => setShowActions(true)}
        colors={headerColors}
        fonts={fonts}
      />

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={immersive ? '#fff' : colors.primary} />
          <Text style={{ color: immersive ? '#fff' : colors.textSecondary, marginTop: 12 }}>
            {labels.loading}
            {dlProgress > 0 && dlProgress < 1 ? ` ${Math.round(dlProgress * 100)}%` : ''}
          </Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Text style={{ color: immersive ? '#fff' : colors.text, textAlign: 'center', paddingHorizontal: 24 }}>
            {error}
          </Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{labels.retry}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} style={{ marginTop: 12 }}>
            <Text style={{ color: immersive ? 'rgba(255,255,255,0.7)' : colors.textSecondary }}>
              {t.common.cancel}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && activeAttachment?.kind === 'image' && imageItems.length > 0 && (
        <AOImageViewer
          items={imageItems}
          initialIndex={Math.max(
            0,
            imageItems.findIndex((i) => i.attachment.id === activeAttachment.id)
          )}
          onIndexChange={(i) => setActiveId(imageItems[i]?.attachment.id || activeAttachment.id)}
        />
      )}

      {!loading && !error && activeAttachment?.kind === 'video' && uriMap[activeAttachment.id] && (
        <AOVideoPlayer
          uri={uriMap[activeAttachment.id]}
          durationHint={activeAttachment.duration}
          labels={{ loading: labels.loading }}
        />
      )}

      {!loading && !error && activeAttachment?.kind === 'document' && (
        <AODocumentViewer
          attachment={activeAttachment}
          localUri={uriMap[activeAttachment.id] || null}
          loading={!uriMap[activeAttachment.id]}
          progress={dlProgress}
          error={null}
          onRetry={load}
          senderName={senderName}
          colors={colors}
          fonts={fonts}
          labels={{
            opening: labels.openingDocument,
            openWith: labels.openWith,
            retry: labels.retry,
            sender: labels.sender,
          }}
        />
      )}

      {!!media?.content?.trim() && !loading && !error && activeAttachment?.kind !== 'document' && (
        <View style={[styles.caption, { backgroundColor: immersive ? 'rgba(0,0,0,0.55)' : colors.surface }]}>
          <Text style={{ color: immersive ? '#fff' : colors.text, fontSize: fonts.sm }} numberOfLines={3}>
            {media.content}
          </Text>
        </View>
      )}

      <ActionMenuSheet
        visible={showActions}
        title={activeAttachment?.fileName || labels.actions}
        items={actionItems}
        onClose={() => setShowActions(false)}
        colors={colors}
        fonts={fonts}
        cancelLabel={t.common.cancel}
      />

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
