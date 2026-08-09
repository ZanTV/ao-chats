import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { getAccessToken } from '../../src/services/storage';
import type { MessageAttachment } from '../../src/attachments/types';
import { formatFileSize, isMessageAttachment } from '../../src/attachments/types';
import { detectEntities, type DetectedEntity } from '../../src/links/detect';
import { DetectedContactActionSheet } from '../../src/components/chat/DetectedContactActionSheet';
import { Spacing, BorderRadius } from '../../src/theme';

type MediaItem = {
  messageId: string;
  content: string;
  createdAt: string;
  attachment?: MessageAttachment;
};

const COLS = 3;
const GAP = 2;
const TILE = Math.floor((Dimensions.get('window').width - GAP * (COLS + 1)) / COLS);

export default function FriendSharedMediaScreen() {
  const { conversationId, type } = useLocalSearchParams<{
    conversationId: string;
    type: string;
    userId?: string;
  }>();
  const mediaType = (String(type || 'image') as 'image' | 'video' | 'document' | 'link');
  const cid = String(conversationId || '');
  const { colors, fonts, t } = useSettingsStore();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>();
  const [linkEntity, setLinkEntity] = useState<DetectedEntity | null>(null);

  const title =
    mediaType === 'video'
      ? t.friendInfo.videos
      : mediaType === 'document'
        ? t.friendInfo.documents
        : mediaType === 'link'
          ? t.friendInfo.links
          : t.friendInfo.photos;

  useEffect(() => {
    getAccessToken().then((token) => {
      if (token) setAuthHeaders({ Authorization: `Bearer ${token}` });
    });
  }, []);

  const load = useCallback(
    async (next?: string | null, append = false) => {
      if (!cid) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await api.getConversationMedia(cid, mediaType, next || undefined);
        const mapped: MediaItem[] = (res.items || []).map((row) => ({
          messageId: row.messageId,
          content: row.content,
          createdAt: row.createdAt,
          attachment: isMessageAttachment(row.attachment) ? row.attachment : undefined,
        }));
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

  const openAttachment = (attachment?: MessageAttachment) => {
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

  const formatSharedDate = (iso: string) => {
    const d = new Date(iso);
    return `${t.friendInfo.sharedOn} ${d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`;
  };

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
              {formatSharedDate(item.createdAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      );
    }

    if (mediaType === 'document') {
      const a = item.attachment;
      const ext = (a?.fileName || '').split('.').pop()?.toUpperCase() || 'FILE';
      return (
        <TouchableOpacity
          style={[styles.docRow, { borderBottomColor: colors.border }]}
          onPress={() => openAttachment(a)}
        >
          <View style={[styles.docIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fonts.md, fontWeight: '500' }} numberOfLines={1}>
              {a?.fileName || 'Document'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, marginTop: 2 }}>
              {ext} · {formatFileSize(a?.fileSize || 0)}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, marginTop: 2 }}>
              {formatSharedDate(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    const a = item.attachment;
    const uri = a?.url;
    return (
      <TouchableOpacity style={styles.tile} onPress={() => openAttachment(a)}>
        {uri ? (
          <Image
            source={{ uri, headers: authHeaders }}
            style={styles.tileImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.tileImage, { backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons
              name={mediaType === 'video' ? 'videocam' : 'image'}
              size={28}
              color={colors.textTertiary}
            />
          </View>
        )}
        {mediaType === 'video' && (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
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
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>{t.friendInfo.emptyMedia}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.messageId}-${index}`}
          numColumns={mediaType === 'image' || mediaType === 'video' ? COLS : 1}
          key={mediaType}
          renderItem={renderItem}
          contentContainerStyle={
            mediaType === 'image' || mediaType === 'video'
              ? { padding: GAP }
              : { paddingVertical: Spacing.sm }
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
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontWeight: '600' },
  tile: {
    width: TILE,
    height: TILE,
    margin: GAP / 2,
  },
  tileImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.sm,
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
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
