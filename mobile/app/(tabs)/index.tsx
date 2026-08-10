import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  BackHandler,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useChatComposerStore } from '../../src/stores/chatComposerStore';
import { api } from '../../src/services/api';
import { ApiError } from '../../src/utils/validation';
import { socketService } from '../../src/services/socket';
import { cacheManager, CacheDomain } from '../../src/cache';
import { ActionMenuSheet } from '../../src/components/ActionMenuSheet';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useLiveAvatarPatches } from '../../src/profile/useLiveAvatarPatches';
import {
  ConversationSelectionBar,
  type ConversationListAction,
} from '../../src/components/ConversationSelectionBar';
import { NotificationBell } from '../../src/components/NotificationPanel';
import { AoMessageStatus } from '../../src/components/chat/AoMessageStatus';
import {
  formatConversationTime,
  getConversationListPreview,
  getListMessageStatus,
  sortConversations,
} from '../../src/utils/conversation';
import { useTypingStore } from '../../src/stores/typingStore';
import { Spacing, BorderRadius } from '../../src/theme';
import { perfAsync } from '../../src/utils/perfTimings';

const CONVERSATIONS_REFRESH_MS = 30_000;

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
    id?: string;
    content: string;
    preview?: string;
    senderId: string;
    senderName?: string;
    type?: string;
    createdAt: string;
    isRead: boolean;
    status?: string;
    deliveredAt?: string;
    readAt?: string;
    waitingAt?: string;
    isEdited?: boolean;
  } | null;
  updatedAt: string;
  unreadCount: number;
}

interface ConversationUpdatePayload {
  conversationId: string;
  updatedAt?: string;
  lastMessage?: Conversation['lastMessage'] | null;
  unreadCount?: number;
  removeFromList?: boolean;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { colors, fonts, t, language } = useSettingsStore();
  const { drafts, pendingByConversation, loadAll } = useChatComposerStore();
  const typingConversations = useTypingStore((s) => s.typingConversations);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showHomeMenu, setShowHomeMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConversationListAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lastFetchRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionMode = selectedIds.size > 0;

  const locale = language === 'sw' ? 'sw-KE' : undefined;

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectedIds(new Set());
    setConfirmAction(null);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enterSelection = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  const selectedConversations = useMemo(
    () => conversations.filter((c) => selectedIds.has(c.id)),
    [conversations, selectedIds]
  );

  const blockableSelected = useMemo(
    () =>
      selectedConversations.filter(
        (c) => c.otherUser && !c.otherUser.isSystemAccount && c.otherUser.id !== user?.id
      ),
    [selectedConversations, user?.id]
  );

  const loadConversations = useCallback(async (options?: { background?: boolean }) => {
    setLoadError(null);
    const cached = cacheManager.get<Conversation[]>(CacheDomain.CONVERSATIONS);
    if (cached?.data !== undefined) {
      setConversations(sortConversations(cached.data));
      setLoading(false);
    }

    if (options?.background && cached?.data !== undefined) {
      setSyncing(true);
    }

    try {
      const result = await perfAsync('GET /conversations', () =>
        api.getConversations()
      ) as {
        conversations: Conversation[];
        cacheVersion?: number;
      };
      const sorted = sortConversations(result.conversations || []);
      cacheManager.set(CacheDomain.CONVERSATIONS, sorted, result.cacheVersion);
      setConversations(sorted);
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (cached?.data === undefined) {
        if (err instanceof ApiError && (err.code === 'UNAUTHORIZED' || err.message === 'Session expired')) {
          setLoadError(t.home.sessionExpired);
        } else if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
          setLoadError(err.message);
        } else if (err instanceof ApiError && (err.code === 'DB_ERROR' || err.code === 'INTERNAL_ERROR')) {
          setLoadError(t.home.loadChatsFailed);
        } else {
          setLoadError(err instanceof Error ? err.message : t.home.loadChatsFailed);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
    }
  }, [t]);

  const persistConversations = useCallback((list: Conversation[]) => {
    const sorted = sortConversations(list);
    setConversations(sorted);
    cacheManager.set(CacheDomain.CONVERSATIONS, sorted);
  }, []);

  const removeConversationFromList = useCallback(
    (conversationId: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== conversationId);
        cacheManager.set(CacheDomain.CONVERSATIONS, sortConversations(next));
        return next;
      });
    },
    []
  );

  const applyConversationUpdate = useCallback(
    (payload: ConversationUpdatePayload) => {
      if (payload.removeFromList) {
        removeConversationFromList(payload.conversationId);
        return;
      }

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

        if (payload.lastMessage === null) {
          updated.lastMessage = null;
        } else if (payload.lastMessage) {
          updated.lastMessage = payload.lastMessage;
        }

        // Only apply server-authoritative unread — never invent +1 locally
        if (payload.unreadCount !== undefined) {
          updated.unreadCount = Math.max(0, payload.unreadCount);
        }

        // Upsert by conversationId (never push a second card for the same id)
        const next = prev.filter((c) => c.id !== payload.conversationId);
        const sorted = sortConversations([updated, ...next]);
        cacheManager.set(CacheDomain.CONVERSATIONS, sorted);
        return sorted;
      });
    },
    [loadConversations, removeConversationFromList]
  );

  const runBulkHide = useCallback(
    async (mode: 'remove' | 'delete') => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const previous = conversations;
      const next = conversations.filter((c) => !selectedIds.has(c.id));
      persistConversations(next);
      try {
        await Promise.all(ids.map((id) => api.hideConversation(id, { mode })));
        exitSelectionMode();
        if (mode === 'remove') {
          showToast(
            ids.length === 1
              ? t.home.conversationsRemoved
              : `${ids.length} ${t.home.conversationsRemovedMany}`
          );
        } else {
          showToast(
            ids.length === 1
              ? t.home.conversationsDeleted
              : `${ids.length} ${t.home.conversationsDeletedMany}`
          );
        }
      } catch {
        persistConversations(previous);
        Alert.alert(
          t.common.error,
          mode === 'remove' ? t.home.removeFailed : t.home.deleteFailed
        );
      }
    },
    [conversations, exitSelectionMode, persistConversations, selectedIds, showToast, t]
  );

  const runBulkBlock = useCallback(async () => {
    const targets = blockableSelected;
    if (targets.length === 0) {
      exitSelectionMode();
      return;
    }
    const previous = conversations;
    const hideIds = new Set(targets.map((c) => c.id));
    persistConversations(conversations.filter((c) => !hideIds.has(c.id)));
    try {
      await Promise.all(
        targets.map(async (c) => {
          if (!c.otherUser) return;
          await api.blockUser(c.otherUser.id);
          await api.hideConversation(c.id, { mode: 'remove' });
        })
      );
      exitSelectionMode();
      showToast(
        targets.length === 1
          ? t.home.usersBlocked
          : `${targets.length} ${t.home.usersBlockedMany}`
      );
    } catch {
      persistConversations(previous);
      Alert.alert(t.common.error, t.home.blockFailed);
    }
  }, [
    blockableSelected,
    conversations,
    exitSelectionMode,
    persistConversations,
    showToast,
    t,
  ]);

  const handleSelectionAction = useCallback((action: ConversationListAction) => {
    setConfirmAction(action);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || actionBusy) return;
    setActionBusy(true);
    try {
      if (confirmAction === 'remove') await runBulkHide('remove');
      else if (confirmAction === 'delete') await runBulkHide('delete');
      else if (confirmAction === 'block') await runBulkBlock();
    } finally {
      setActionBusy(false);
      setConfirmAction(null);
    }
  }, [actionBusy, confirmAction, runBulkBlock, runBulkHide]);

  const confirmDialogCopy = useMemo(() => {
    const count = selectedIds.size;
    if (confirmAction === 'delete') {
      return {
        title: count > 1 ? t.home.deleteSelectedTitle : t.home.deleteChatTitle,
        message: count > 1 ? t.home.deleteSelectedMessage : t.home.deleteChatMessage,
        confirmLabel: t.common.delete,
        destructive: true,
      };
    }
    if (confirmAction === 'remove') {
      return {
        title: count > 1 ? t.home.removeSelectedTitle : t.home.removeChatTitle,
        message: count > 1 ? t.home.removeSelectedMessage : t.home.removeChatMessage,
        confirmLabel: t.home.removeChat,
        destructive: false,
      };
    }
    if (confirmAction === 'block') {
      return {
        title: t.home.blockSelectedTitle,
        message: t.home.blockSelectedMessage,
        confirmLabel: t.friends.block,
        destructive: true,
      };
    }
    return null;
  }, [confirmAction, selectedIds.size, t]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(t.home.deleteAllTitle, t.home.deleteAllMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.home.deleteAll,
        style: 'destructive',
        onPress: async () => {
          const previous = conversations;
          persistConversations([]);
          exitSelectionMode();
          try {
            await api.hideAllConversations();
            showToast(
              previous.length === 1
                ? t.home.conversationsDeleted
                : `${previous.length || ''} ${t.home.conversationsDeletedMany}`.trim()
            );
          } catch {
            persistConversations(previous);
            Alert.alert(t.common.error, t.home.deleteFailed);
          }
        },
      },
    ]);
  }, [conversations, exitSelectionMode, persistConversations, showToast, t]);

  const showHomeMenuSheet = useCallback(() => {
    setShowHomeMenu(true);
  }, []);

  const homeMenuItems = useMemo(
    () => [
      {
        key: 'delete-all',
        label: t.home.deleteAll,
        destructive: true,
        onPress: handleDeleteAll,
      },
    ],
    [handleDeleteAll, t]
  );

  useFocusEffect(
    useCallback(() => {
      loadAll();
      const elapsed = Date.now() - lastFetchRef.current;
      if (elapsed > CONVERSATIONS_REFRESH_MS || lastFetchRef.current === 0) {
        loadConversations({ background: true });
      }

      const onBack = () => {
        if (selectedIds.size > 0) {
          exitSelectionMode();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [loadAll, loadConversations, selectedIds.size, exitSelectionMode])
  );

  useEffect(() => {
    loadConversations();

    const unsub1 = socketService.on('conversation:updated', (data: unknown) => {
      applyConversationUpdate(data as ConversationUpdatePayload);
    });
    const unsubStatus = socketService.on('message:status', (data: unknown) => {
      const payload = data as {
        messageId: string;
        status: string;
        deliveredAt?: string;
        readAt?: string;
      };
      setConversations((prev) =>
        prev.map((c) => {
          if (c.lastMessage?.id !== payload.messageId) return c;
          return {
            ...c,
            lastMessage: {
              ...c.lastMessage!,
              status: payload.status,
              deliveredAt: payload.deliveredAt || c.lastMessage!.deliveredAt,
              readAt: payload.readAt || c.lastMessage!.readAt,
            },
          };
        })
      );
    });

    const unsubHidden = socketService.on('conversation:hidden', (data: unknown) => {
      const payload = data as { conversationId: string };
      if (payload.conversationId) removeConversationFromList(payload.conversationId);
    });
    const unsubHideAll = socketService.on('conversation:hide-all', () => {
      persistConversations([]);
    });

    return () => {
      unsub1();
      unsubStatus();
      unsubHidden();
      unsubHideAll();
    };
  }, [loadConversations, applyConversationUpdate, removeConversationFromList, persistConversations]);

  const patchConversationAvatar = useCallback(
    (userId: string, avatarUrl: string | null, avatarVersion: number) => {
      setConversations((prev) => {
        let changed = false;
        const next = prev.map((c) => {
          if (c.otherUser?.id !== userId) return c;
          changed = true;
          return {
            ...c,
            otherUser: {
              ...c.otherUser,
              avatarUrl: avatarUrl as any,
              avatarVersion: avatarVersion as any,
            },
          };
        });
        return changed ? next : prev;
      });
    },
    []
  );
  useLiveAvatarPatches(patchConversationAvatar);

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
        typing: t.chat.typing,
      },
      typingConversations[item.id]
    );
    const listStatus = getListMessageStatus(item.lastMessage, user?.id || '');
    const timeSource = item.lastMessage?.createdAt || item.updatedAt;
    const isTypingPreview = typingConversations[item.id];
    const isSelected = selectedIds.has(item.id);
    const previewColor =
      isTypingPreview
        ? colors.primary
        : previewMeta.isDraft || previewMeta.isPending
          ? colors.draftText
          : item.unreadCount > 0
            ? colors.text
            : colors.textSecondary;

    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          {
            backgroundColor: isSelected ? colors.selectionWrap : colors.surface,
            borderColor: isSelected ? colors.selectionRing : 'transparent',
            borderWidth: isSelected ? 1.5 : 0,
          },
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleSelect(item.id);
            return;
          }
          router.push(`/chat/${item.id}`);
        }}
        onLongPress={() => {
          if (selectionMode) toggleSelect(item.id);
          else enterSelection(item.id);
        }}
        delayLongPress={350}
        activeOpacity={0.7}
      >
        {selectionMode ? (
          <View
            style={[
              styles.selectMark,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.primary : 'transparent',
              },
            ]}
          >
            {isSelected ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
          </View>
        ) : null}
        <Avatar
          userId={item.otherUser?.id}
          avatarId={item.otherUser?.avatarId || 'avatar-30'}
          imageUrl={(item.otherUser as { avatarUrl?: string } | undefined)?.avatarUrl}
          imageVersion={(item.otherUser as { avatarVersion?: number } | undefined)?.avatarVersion}
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
                  fontStyle: previewMeta.isDraft || previewMeta.isPending || isTypingPreview ? 'italic' : 'normal',
                },
                item.unreadCount > 0 && !previewMeta.isDraft && !previewMeta.isPending && !isTypingPreview && { fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {previewMeta.text}
            </Text>
            {listStatus && !isTypingPreview && !previewMeta.isDraft && !previewMeta.isPending && (
              <AoMessageStatus
                status={listStatus}
                color={colors.textTertiary}
                readColor={colors.primary}
                size={13}
              />
            )}
            {item.isPinned && (
              <Ionicons name="pin" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
            )}
            {item.unreadCount > 0 && !selectionMode && (
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
      {selectionMode ? (
        <ConversationSelectionBar
          selectedCount={selectedIds.size}
          selectedLabel={t.chat.selected}
          deleteLabel={t.common.delete}
          removeLabel={t.home.removeChat}
          blockLabel={t.friends.block}
          onBack={exitSelectionMode}
          onAction={handleSelectionAction}
          blockEnabled={blockableSelected.length > 0}
          colors={colors}
          fonts={fonts}
        />
      ) : (
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.title }]}>
            {t.app.name}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={showHomeMenuSheet}
              style={styles.headerMenuBtn}
              accessibilityLabel={t.home.chatOptions}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </TouchableOpacity>
            <NotificationBell />
          </View>
        </View>
      )}

      {!selectionMode && (
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontSize: fonts.md }]}
            placeholder={t.home.search}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {syncing ? (
            <Text style={{ color: colors.textTertiary, fontSize: fonts.xs }}>{t.home.syncing}</Text>
          ) : null}
        </View>
      )}

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        extraData={selectedIds}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={7}
        initialNumToRender={15}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          selectionMode ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversations({ background: true });
              }}
              tintColor={colors.primary}
            />
          )
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              {loadError ? (
                <>
                  <Ionicons name="cloud-offline-outline" size={64} color={colors.danger} />
                  <Text style={[styles.emptyText, { color: colors.danger, fontSize: fonts.md }]}>
                    {loadError}
                  </Text>
                  <TouchableOpacity onPress={() => { setLoading(true); loadConversations(); }}>
                    <Text style={[styles.emptySubtext, { color: colors.primary, fontSize: fonts.sm }]}>
                      {t.common.retry}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.md }]}>
                    {t.home.noChats}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textTertiary, fontSize: fonts.sm }]}>
                    {t.home.startChat}
                  </Text>
                </>
              )}
            </View>
          ) : null
        }
      />

      {!selectionMode && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/friends')}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {toast ? (
        <View style={[styles.toast, { backgroundColor: colors.surfaceSecondary || colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: fonts.sm }}>{toast}</Text>
        </View>
      ) : null}

      <ActionMenuSheet
        visible={showHomeMenu}
        title={t.home.chatOptions}
        items={homeMenuItems}
        onClose={() => setShowHomeMenu(false)}
        cancelLabel={t.common.cancel}
        colors={colors}
        fonts={fonts}
      />

      {confirmDialogCopy && (
        <ConfirmDialog
          visible={!!confirmAction}
          title={confirmDialogCopy.title}
          message={confirmDialogCopy.message}
          confirmLabel={confirmDialogCopy.confirmLabel}
          cancelLabel={t.common.cancel}
          destructive={confirmDialogCopy.destructive}
          busy={actionBusy}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            if (!actionBusy) setConfirmAction(null);
          }}
          colors={colors}
          fonts={fonts}
        />
      )}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerMenuBtn: { padding: Spacing.xs },
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
    marginHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  selectMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 88,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: Spacing.sm },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatName: { fontWeight: '600', flexShrink: 1 },
  officialTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  officialText: { fontWeight: '600' },
  chatTime: { flexShrink: 0 },
  chatFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
