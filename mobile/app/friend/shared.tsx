import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { coerceAttachment, type MessageAttachment } from '../../src/attachments/types';
import { detectEntities, type DetectedEntity } from '../../src/links/detect';
import { DetectedContactActionSheet } from '../../src/components/chat/DetectedContactActionSheet';
import { SharedMediaPreview } from '../../src/components/SharedMediaPreview';
import { Spacing, BorderRadius } from '../../src/theme';

type MediaItem = {
  messageId: string;
  content: string;
  createdAt: string;
  attachment?: MessageAttachment | null;
};

const COLS = 3;
const H_PAD = 4;
const GAP = 2;
const SCREEN_W = Dimensions.get('window').width;
const TILE = Math.floor((SCREEN_W - H_PAD * 2 - GAP * (COLS - 1)) / COLS);

export default function FriendSharedMediaScreen() {
  const { conversationId, type } = useLocalSearchParams<{
    conversationId: string;
    type: string;
    userId?: string;
  }>();
  const mediaType = String(type || 'image') as 'image' | 'video' | 'document' | 'link';
  const cid = String(conversationId || '');
  const { colors, fonts, t } = useSettingsStore();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [linkEntity, setLinkEntity] = useState<DetectedEntity | null>(null);

  const title =
    mediaType === 'video'
      ? t.friendInfo.videos
      : mediaType === 'document'
        ? t.friendInfo.documents
        : mediaType === 'link'
          ? t.friendInfo.links
          : t.friendInfo.photos;

  const isGrid = mediaType === 'image' || mediaType === 'video';

  const load = useCallback(
    async (next?: string | null, append = false) => {
      if (!cid) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await api.getConversationMedia(cid, mediaType, next || undefined, 30);
        const mapped: MediaItem[] = (res.items || []).map((row) => ({
          messageId: row.messageId,
          content: row.content,
          createdAt: row.createdAt,
          attachment: coerceAttachment(row.attachment),
        }));
        // Server already sorts createdAt DESC — keep stable newest-first
        setItems((prev) => (append ? [...prev, ...mapped] : mapped));
        setCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore));
      } catch {
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cid, mediaType]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refresh list when new media arrives or messages are deleted
  useEffect(() => {
    if (!cid) return;
    const refresh = () => {
      void load(null, false);
    };
    const unsubs = [
      socketService.on('message:new', (data: unknown) => {
        const msg = data as { conversationId?: string; attachment?: unknown; type?: string };
        if (msg.conversationId !== cid) return;
        if (!msg.attachment && msg.type === 'TEXT') return;
        refresh();
      }),
      socketService.on('message:delete', (data: unknown) => {
        const payload = data as { conversationId?: string; messageId?: string };
        if (payload.conversationId !== cid) return;
        if (payload.messageId) {
          setItems((prev) => prev.filter((i) => i.messageId !== payload.messageId));
        } else {
          refresh();
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [cid, load]);

  const openAttachment = (attachment?: MessageAttachment | null) => {
    if (!attachment?.id) return;
    router.push(`/media/${attachment.id}` as any);
  };

  const openLinkRow = (content: string) => {
    const entities = detectEntities(content).filter(
      (e) => e.type === 'url' || e.type === 'ao_chats' || e.type === 'location'
    );
    if (!entities.length) return;
    setLinkEntity(entities[0]);
  };

  const skeleton = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => (
        <View
          key={`sk-${i}`}
          style={{
            width: TILE,
            height: TILE,
            marginBottom: GAP,
            marginRight: (i + 1) % COLS === 0 ? 0 : GAP,
            borderRadius: BorderRadius.sm,
            backgroundColor: colors.surfaceSecondary,
          }}
        />
      )),
    [colors.surfaceSecondary]
  );

  const renderItem = ({ item }: { item: MediaItem }) => {
    if (mediaType === 'link') {
      const entities = detectEntities(item.content).filter(
        (e) => e.type === 'url' || e.type === 'ao_chats' || e.type === 'location'
      );
      const primary = entities[0];
      return (
        <TouchableOpacity
          style={[styles.linkRow, { borderBottomColor: colors.border }]}
          onPress={() => openLinkRow(item.content)}
        >
          <Ionicons name="link-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fonts.sm }} numberOfLines={2}>
              {primary?.display || item.content}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, marginTop: 2 }}>
              {t.friendInfo.sharedOn}{' '}
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      );
    }

    if (!item.attachment) {
      return (
        <View
          style={[
            isGrid
              ? { width: TILE, height: TILE, backgroundColor: colors.surfaceSecondary, borderRadius: BorderRadius.sm }
              : styles.linkRow,
          ]}
        />
      );
    }

    return (
      <SharedMediaPreview
        attachment={item.attachment}
        createdAt={item.createdAt}
        tileSize={TILE}
        colors={colors}
        fonts={fonts}
        sharedOnLabel={t.friendInfo.sharedOn}
        onPress={() => openAttachment(item.attachment)}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.nav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text, fontSize: fonts.lg }]}>{title}</Text>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        isGrid ? (
          <View style={[styles.skeletonWrap, { paddingHorizontal: H_PAD, paddingTop: H_PAD }]}>
            {skeleton}
          </View>
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>{t.friendInfo.emptyMedia}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.messageId}-${index}`}
          numColumns={isGrid ? COLS : 1}
          key={mediaType}
          renderItem={renderItem}
          columnWrapperStyle={
            isGrid
              ? { paddingHorizontal: H_PAD, gap: GAP, marginBottom: GAP }
              : undefined
          }
          contentContainerStyle={
            isGrid ? { paddingTop: H_PAD, paddingBottom: Spacing.xl } : { paddingVertical: Spacing.sm }
          }
          onEndReached={() => {
            if (hasMore && cursor && !loadingMore) void load(cursor, true);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: Spacing.md }} color={colors.primary} />
            ) : null
          }
        />
      )}

      <DetectedContactActionSheet
        visible={Boolean(linkEntity)}
        entity={linkEntity}
        onClose={() => setLinkEntity(null)}
        labels={{
          open: t.friendInfo.openLink,
          openEmail: t.friendInfo.openLink,
          openLocation: t.friendInfo.openLink,
          call: t.friendInfo.openLink,
          copy: t.friendInfo.copyLink,
          cancel: t.common.cancel,
          copiedLink: t.media.linkCopied,
          copiedEmail: t.media.linkCopied,
          copiedPhone: t.media.linkCopied,
          copiedLocation: t.media.linkCopied,
        }}
        colors={colors}
        fonts={fonts}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
