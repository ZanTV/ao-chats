import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useChatComposerStore } from '../../src/stores/chatComposerStore';
import { api } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { cacheManager, CacheDomain } from '../../src/cache';
import { NotificationBell } from '../../src/components/NotificationPanel';
import {
  formatConversationTime,
  getConversationListPreview,
  sortConversations,
} from '../../src/utils/conversation';
import { Spacing, BorderRadius } from '../../src/theme';

interface Conversation {
  id: string;
  isPinned: boolean;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string;
    avatarId: string;
    status: string;
    isVerified?: boolean;
    isSystemAccount?: boolean;
  } | null;
  lastMessage: {
    content: string;
    preview?: string;
    senderId: string;
    senderName?: string;
    type?: string;
    createdAt: string;
    isRead: boolean;
  } | null;
  updatedAt: string;
  unreadCount: number;
}

interface ConversationUpdatePayload {
  conversationId: string;
  updatedAt?: string;
  lastMessage?: Conversation['lastMessage'];
  unreadCount?: number;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { colors, fonts, t, language } = useSettingsStore();
  const { drafts, pendingByConversation, loadAll } = useChatComposerStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const locale = language === 'sw' ? 'sw-KE' : undefined;

  const loadConversations = useCallback(async () => {
    await cacheManager.loadWithRefresh<Conversation[]>(
      CacheDomain.CONVERSATIONS,
      async () => {
        const result = await api.getConversations() as {
          conversations: Conversation[];
          cacheVersion?: number;
        };
        return {
          data: sortConversations(result.conversations || []),
          cacheVersion: result.cacheVersion,
        };
      },
      (data) => setConversations(data)
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  const applyConversationUpdate = useCallback(
    (payload: ConversationUpdatePayload) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversationId);
        if (idx === -1) {
          loadConversations();
          return prev;
        }

        const current = prev[idx];
        const updated: Conversation = {
          ...current,
          updatedAt: payload.updatedAt || payload.lastMessage?.createdAt || current.updatedAt,
        };

        if (payload.lastMessage) {
          updated.lastMessage = payload.lastMessage;
          if (payload.unreadCount === undefined && payload.lastMessage.senderId !== user?.id) {
            updated.unreadCount = (current.unreadCount || 0) + 1;
          }
        }

        if (payload.unreadCount !== undefined) {
          updated.unreadCount = payload.unreadCount;
        }

        const next = [...prev];
        next.splice(idx, 1);
        return sortConversations([updated, ...next]);
      });
    },
    [loadConversations, user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      loadAll();
      loadConversations();
    }, [loadAll, loadConversations])
  );

  useEffect(() => {
    loadConversations();

    const unsub1 = socketService.on('conversation:updated', (data: unknown) => {
      applyConversationUpdate(data as ConversationUpdatePayload);
    });
    const unsubUpdate = socketService.on('conversation:update', (data: unknown) => {
      applyConversationUpdate(data as ConversationUpdatePayload);
    });
    const unsub2 = socketService.on('message:new', (data: unknown) => {
      const payload = data as { conversationId?: string };
      if (payload.conversationId) {
        applyConversationUpdate({ conversationId: payload.conversationId });
      }
    });

    return () => {
      unsub1();
      unsubUpdate();
      unsub2();
    };
  }, [loadConversations, applyConversationUpdate]);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const name = `${c.otherUser?.firstName} ${c.otherUser?.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const renderItem = ({ item }: { item: Conversation }) => {
    const displayName = item.otherUser
      ? `${item.otherUser.firstName} ${item.otherUser.lastName}`
      : 'Unknown';
    const previewMeta = getConversationListPreview(
      item.lastMessage,
      drafts[item.id],
      pendingByConversation[item.id],
      user?.id || '',
      {
        you: t.chat.you,
        draft: t.home.draft,
        sending: t.home.sending,
        failed: t.home.sendFailed,
        fallback: t.home.startChat,
      }
    );
    const timeSource = item.lastMessage?.createdAt || item.updatedAt;
    const previewColor =
      previewMeta.isDraft || previewMeta.isPending
        ? colors.draftText
        : item.unreadCount > 0
          ? colors.text
          : colors.textSecondary;

    return (
      <TouchableOpacity
        style={[styles.chatItem, { backgroundColor: colors.surface }]}
        onPress={() => router.push(`/chat/${item.id}`)}
        activeOpacity={0.7}
      >
        <Avatar
          avatarId={item.otherUser?.avatarId || 'avatar-30'}
          size={56}
          showOnline
          isOnline={item.otherUser?.status === 'ONLINE'}
          isVerified={item.otherUser?.isVerified}
        />
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <View style={styles.nameRow}>
              <Text style={[styles.chatName, { color: colors.text, fontSize: fonts.md }]} numberOfLines={1}>
                {displayName}
              </Text>
              {item.otherUser?.isSystemAccount && (
                <View style={[styles.officialTag, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.officialText, { color: colors.primary, fontSize: fonts.xs }]}>
                    Official
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.chatTime, { color: colors.textTertiary, fontSize: fonts.xs }]}>
              {timeSource ? formatConversationTime(timeSource, locale) : ''}
            </Text>
          </View>
          <View style={styles.chatFooter}>
            <Text
              style={[
                styles.chatPreview,
                {
                  color: previewColor,
                  fontSize: fonts.sm,
                  fontStyle: previewMeta.isDraft || previewMeta.isPending ? 'italic' : 'normal',
                },
                item.unreadCount > 0 && !previewMeta.isDraft && !previewMeta.isPending && { fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {previewMeta.text}
            </Text>
            {item.isPinned && (
              <Ionicons name="pin" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
            )}
            {item.unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.title }]}>
          {t.home.title}
        </Text>
        <NotificationBell />
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text, fontSize: fonts.md }]}
          placeholder={t.home.search}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={7}
        initialNumToRender={15}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadConversations();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.md }]}>
                {t.home.noChats}
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary, fontSize: fonts.sm }]}>
                {t.home.startChat}
              </Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(tabs)/friends')}
        activeOpacity={0.8}
      >
        <Ionicons name="create-outline" size={28} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1 },
  chatItem: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: Spacing.sm },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatName: { fontWeight: '600', flexShrink: 1 },
  officialTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  officialText: { fontWeight: '600' },
  chatTime: { flexShrink: 0 },
  chatFooter: { flexDirection: 'row', alignItems: 'center' },
  chatPreview: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: Spacing.sm,
  },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { marginTop: Spacing.md, fontWeight: '600' },
  emptySubtext: { marginTop: Spacing.xs },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
