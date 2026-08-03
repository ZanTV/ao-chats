import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../../src/components/Avatar';
import { SwipeableMessageRow } from '../../src/components/chat/SwipeableMessageRow';
import { MessageActionBar, MessageAction } from '../../src/components/chat/MessageActionBar';
import { ReplyPreviewBar } from '../../src/components/chat/ReplyPreviewBar';
import { ReactionPicker } from '../../src/components/chat/ReactionPicker';
import { ForwardSheet } from '../../src/components/chat/ForwardSheet';
import { MessageInfoSheet } from '../../src/components/chat/MessageInfoSheet';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { cacheData, getCachedData } from '../../src/services/storage';
import { ApiError } from '../../src/utils/validation';
import {
  ChatMessage,
  dedupeMessages,
  normalizeMessage,
  upsertMessage,
} from '../../src/utils/messages';
import { applyStatusUpdate } from '../../src/utils/messageStatus';
import { Spacing, BorderRadius } from '../../src/theme';

type Message = ChatMessage;

interface ConversationInfo {
  participants: Array<{
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatarId: string;
      status: string;
      isVerified?: boolean;
      isSystemAccount?: boolean;
      statusMessage?: string;
    };
  }>;
}

function normalizeId(id: string | string[] | undefined): string | undefined {
  if (!id) return undefined;
  return Array.isArray(id) ? id[0] : id;
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = normalizeId(params.id);
  const { user } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const messagesRef = useRef<Message[]>([]);

  const otherUser = conversation?.participants.find((p) => p.userId !== user?.id)?.user;
  const recipientOnline = otherUser?.status === 'ONLINE';

  const actionLabels = useMemo(
    () => ({
      reply: t.chat.reply,
      react: t.chat.react,
      forward: t.chat.forward,
      pin: t.chat.pin,
      copy: t.chat.copy,
      star: t.chat.star,
      info: t.chat.info,
      delete: t.chat.delete,
    }),
    [t]
  );

  const persistMessages = useCallback(async (list: Message[]) => {
    if (!conversationId || list.length === 0) return;
    messagesRef.current = list;
    await cacheData(`messages:${conversationId}`, list);
  }, [conversationId]);

  const applyMessages = useCallback((list: Message[]) => {
    const unique = dedupeMessages(list);
    setMessages(unique);
    messagesRef.current = unique;
    if (unique.length > 0) cacheData(`messages:${conversationId!}`, unique);
  }, [conversationId]);

  const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      persistMessages(next);
      return next;
    });
  }, [persistMessages]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoadError(null);
    const cached = await getCachedData<Message[]>(`messages:${conversationId}`);
    if (cached?.length) applyMessages(cached);
    try {
      const msgRes = await api.getMessages(conversationId) as { messages: Record<string, unknown>[] };
      applyMessages((msgRes.messages || []).map(normalizeMessage));
    } catch (err) {
      if (!messagesRef.current.length) {
        setLoadError(err instanceof Error ? err.message : t.common.error);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, applyMessages, t.common.error]);

  const loadConversationMeta = useCallback(async () => {
    if (!conversationId) return;
    try {
      const [convRes, pinsRes] = await Promise.all([
        api.getConversation(conversationId),
        api.getPinnedMessages(conversationId),
      ]);
      setConversation(convRes as ConversationInfo);
      const pins = ((pinsRes as { pins: Array<{ message: Record<string, unknown>; messageId: string }> }).pins || []);
      setPinnedMessages(pins.map((p) => normalizeMessage(p.message)));
      setPinnedIds(new Set(pins.map((p) => p.messageId)));
    } catch {
      // non-blocking
    }
  }, [conversationId]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    setActionTarget(null);
  };

  const toggleSelect = (message: Message) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(message.id)) next.delete(message.id);
      else next.add(message.id);
      if (next.size === 0) setSelectionMode(false);
      else setSelectionMode(true);
      return next;
    });
    setActionTarget(message);
  };

  const scrollToMessage = (messageId: string) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index >= 0) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      setLoading(true);
      loadMessages();
      loadConversationMeta();
      socketService.joinConversation(conversationId);
      socketService.markRead(conversationId);
      return () => socketService.leaveConversation(conversationId);
    }, [conversationId, loadMessages, loadConversationMeta])
  );

  useEffect(() => {
    if (!conversationId) return;

    const unsubs = [
      socketService.on('message:new', (data: unknown) => {
        const raw = data as Record<string, unknown> & { tempId?: string };
        const msg = normalizeMessage(raw);
        updateMessages((prev) => upsertMessage(prev, msg, raw.tempId));
        if (msg.senderId !== user?.id && conversationId) {
          socketService.markDelivered(msg.id, conversationId);
        }
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      }),
      socketService.on('message:error', (data: unknown) => {
        const { tempId, error } = data as { tempId?: string; error?: string };
        if (!tempId) return;
        updateMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m))
        );
        if (error) Alert.alert(t.common.error, error);
      }),
      socketService.on('message:status', (data: unknown) => {
        const payload = data as {
          messageId: string;
          status: string;
          deliveredAt?: string;
          readAt?: string;
          waitingAt?: string | null;
        };
        updateMessages((prev) =>
          prev.map((m) => (m.id === payload.messageId ? applyStatusUpdate(m, payload) : m))
        );
      }),
      socketService.on('message:status:bulk', (data: unknown) => {
        const { readerId, readAt } = data as { readerId: string; readAt: string };
        if (readerId === user?.id) return;
        updateMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.id ? applyStatusUpdate(m, { status: 'READ', readAt }) : m
          )
        );
      }),
      socketService.on('message:read', (data: unknown) => {
        const { userId: readerId, readAt } = data as { userId: string; readAt: string };
        if (readerId === user?.id) return;
        updateMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.id ? applyStatusUpdate(m, { status: 'READ', readAt }) : m
          )
        );
      }),
      socketService.on('message:delivered', (data: unknown) => {
        const { messageId, deliveredAt } = data as { messageId: string; deliveredAt: string };
        updateMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? applyStatusUpdate(m, { status: 'DELIVERED', deliveredAt }) : m
          )
        );
      }),
      socketService.on('message:react', (data: unknown) => {
        const payload = data as {
          messageId: string;
          action: string;
          emoji: string;
          userId: string;
          reaction?: { user: { firstName: string } };
        };
        updateMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.messageId) return m;
            if (payload.action === 'removed') {
              return {
                ...m,
                reactions: m.reactions.filter(
                  (r) => !(r.userId === payload.userId && r.emoji === payload.emoji)
                ),
              };
            }
            return {
              ...m,
              reactions: [
                ...m.reactions,
                {
                  emoji: payload.emoji,
                  userId: payload.userId,
                  user: payload.reaction?.user || { firstName: 'User' },
                },
              ],
            };
          })
        );
      }),
      socketService.on('message:delete', (data: unknown) => {
        const { messageId, forEveryone } = data as { messageId: string; forEveryone: boolean };
        updateMessages((prev) => {
          if (forEveryone) {
            return prev.map((m) =>
              m.id === messageId
                ? { ...m, deletedForAll: true, content: 'This message was deleted' }
                : m
            );
          }
          return prev.filter((m) => m.id !== messageId);
        });
      }),
      socketService.on('message:pin', () => loadConversationMeta()),
      socketService.on('message:unpin', () => loadConversationMeta()),
      socketService.on('message:star', (data: unknown) => {
        const { messageId, starred } = data as { messageId: string; starred: boolean };
        updateMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isStarred: starred } : m))
        );
      }),
      socketService.on('message:status:refresh', () => loadMessages()),
      socketService.on('typing:start', (data: unknown) => {
        const { userId } = data as { userId: string };
        if (userId !== user?.id) setIsTyping(true);
      }),
      socketService.on('typing:stop', () => setIsTyping(false)),
    ];

    return () => unsubs.forEach((u) => u());
  }, [conversationId, user?.id, updateMessages, loadConversationMeta, loadMessages, t.common.error]);

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId || !user) return;
    const content = inputText.trim();
    const replyToId = replyTo?.id;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      content,
      senderId: user.id,
      type: 'TEXT',
      replyToId,
      replyTo: replyTo
        ? { id: replyTo.id, content: replyTo.content, sender: { firstName: replyTo.replyTo?.sender?.firstName || '' } }
        : undefined,
      reactions: [],
      createdAt: new Date().toISOString(),
      pending: true,
      status: recipientOnline ? 'SENT' : 'WAITING',
      waitingAt: recipientOnline ? undefined : new Date().toISOString(),
    };

    updateMessages((prev) => [...prev, optimistic]);
    setInputText('');
    setReplyTo(null);
    socketService.stopTyping(conversationId);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const saved = normalizeMessage(
        (await api.sendMessage(conversationId, content, replyToId, tempId)) as Record<string, unknown>
      );
      updateMessages((prev) => upsertMessage(prev, saved, tempId));
    } catch (err) {
      updateMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m))
      );
      Alert.alert(t.common.error, err instanceof ApiError ? err.message : t.chat.sendFailed);
    }
  };

  const retryMessage = async (failedMsg: Message) => {
    if (!conversationId) return;
    const retryTempId = failedMsg.id.startsWith('temp-') ? failedMsg.id : `temp-${Date.now()}`;
    updateMessages((prev) =>
      prev.map((m) =>
        m.id === failedMsg.id ? { ...m, id: retryTempId, pending: true, failed: false } : m
      )
    );
    try {
      const saved = normalizeMessage(
        (await api.sendMessage(conversationId, failedMsg.content, failedMsg.replyToId, retryTempId)) as Record<string, unknown>
      );
      updateMessages((prev) => upsertMessage(prev, saved, retryTempId));
    } catch (err) {
      updateMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...m, pending: false, failed: true } : m))
      );
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!conversationId) return;
    socketService.startTyping(conversationId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socketService.stopTyping(conversationId), 2000);
  };

  const getPrimarySelected = (): Message | null => {
    const id = actionTarget?.id || Array.from(selectedIds)[0];
    return messages.find((m) => m.id === id) || null;
  };

  const handleAction = (action: MessageAction) => {
    const message = getPrimarySelected();
    if (!message || !conversationId) return;
    const isOwn = message.senderId === user?.id;

    switch (action) {
      case 'reply':
        setReplyTo(message);
        clearSelection();
        break;
      case 'react':
        setShowReactionPicker(true);
        break;
      case 'forward':
        setShowForward(true);
        break;
      case 'pin':
        if (pinnedIds.has(message.id)) {
          socketService.unpinMessage(message.id, conversationId);
        } else {
          socketService.pinMessage(message.id, conversationId);
        }
        clearSelection();
        break;
      case 'copy':
        Clipboard.setStringAsync(message.content);
        clearSelection();
        break;
      case 'star':
        if (message.isStarred) {
          socketService.unstarMessage(message.id, conversationId);
        } else {
          socketService.starMessage(message.id, conversationId);
        }
        clearSelection();
        break;
      case 'info':
        setInfoMessage(message);
        clearSelection();
        break;
      case 'delete':
        Alert.alert(t.chat.delete, undefined, [
          {
            text: t.chat.deleteForMe,
            style: 'destructive',
            onPress: () => {
              socketService.deleteMessage(message.id, conversationId, false);
              clearSelection();
            },
          },
          ...(isOwn
            ? [{
                text: t.chat.deleteForEveryone,
                style: 'destructive' as const,
                onPress: () => {
                  socketService.deleteMessage(message.id, conversationId, true);
                  clearSelection();
                },
              }]
            : []),
          { text: t.common.cancel, style: 'cancel' },
        ]);
        break;
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubbleColors = {
    bubbleSent: colors.bubbleSent,
    bubbleReceived: colors.bubbleReceived,
    bubbleSentText: colors.bubbleSentText,
    bubbleReceivedText: colors.bubbleReceivedText,
    primary: colors.primary,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    danger: colors.danger,
    warning: colors.warning,
    surface: colors.surface,
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id;
    const isSelected = selectedIds.has(item.id);

    return (
      <View style={isSelected ? [styles.selectedWrap, { backgroundColor: colors.primary + '08' }] : undefined}>
        <SwipeableMessageRow
          message={item}
          isOwn={isOwn}
          isSelected={isSelected}
          isPinned={pinnedIds.has(item.id)}
          colors={bubbleColors}
          fonts={fonts}
          formatTime={formatTime}
          onPress={() => {
            if (selectionMode) toggleSelect(item);
            else if (item.failed) retryMessage(item);
          }}
          onLongPress={() => toggleSelect(item)}
          onSwipeReply={() => setReplyTo(item)}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.chatHeader, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => (selectionMode ? clearSelection() : router.back())} style={styles.backBtn}>
          <Ionicons name={selectionMode ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        {otherUser && !selectionMode && (
          <>
            <Avatar avatarId={otherUser.avatarId} size={40} showOnline isOnline={otherUser.status === 'ONLINE'} isVerified={otherUser.isVerified} />
            <View style={styles.headerInfo}>
              <Text style={[styles.headerName, { color: colors.text, fontSize: fonts.md }]}>
                {otherUser.firstName} {otherUser.lastName}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fonts.xs }}>
                {otherUser.isSystemAccount
                  ? otherUser.statusMessage || 'Official AO Chats Support'
                  : isTyping ? t.chat.typing : otherUser.status === 'ONLINE' ? t.chat.online : t.chat.offline}
              </Text>
            </View>
          </>
        )}
        {selectionMode && (
          <Text style={[styles.headerName, { color: colors.text, fontSize: fonts.md, flex: 1 }]}>
            {selectedIds.size} {t.chat.selected}
          </Text>
        )}
      </View>

      <MessageActionBar
        visible={selectionMode && selectedIds.size > 0}
        selectedCount={selectedIds.size}
        labels={actionLabels}
        onAction={handleAction}
        onClose={clearSelection}
        colors={colors}
        fonts={fonts}
      />

      {pinnedMessages.length > 0 && (
        <TouchableOpacity
          style={[styles.pinnedBar, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}
          onPress={() => scrollToMessage(pinnedMessages[0].id)}
        >
          <Ionicons name="pin" size={16} color={colors.primary} />
          <Text style={[styles.pinnedText, { color: colors.text, fontSize: fonts.sm }]} numberOfLines={1}>
            {pinnedMessages[0].content}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: fonts.xs }}>{pinnedMessages.length}</Text>
        </TouchableOpacity>
      )}

      {loading && messages.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : loadError && messages.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
          <Text style={{ color: colors.textSecondary, marginTop: Spacing.md }}>{loadError}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => { setLoading(true); loadMessages(); }}>
            <Text style={{ color: '#FFF', fontWeight: '600' }}>{t.common.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollToIndexFailed={() => flatListRef.current?.scrollToEnd({ animated: true })}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={11}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ color: colors.textSecondary }}>{t.chat.sayHello}</Text>
            </View>
          }
        />
      )}

      {replyTo && (
        <ReplyPreviewBar
          replyTo={replyTo}
          senderName={replyTo.senderId === user?.id ? t.chat.you : (replyTo.replyTo?.sender?.firstName || otherUser?.firstName || '')}
          replyLabel={t.chat.reply}
          onClose={() => setReplyTo(null)}
          onPress={() => scrollToMessage(replyTo.id)}
          colors={colors}
          fonts={fonts}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.inputBackground, color: colors.text, fontSize: fonts.md }]}
            placeholder={t.chat.typeMessage}
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={handleTyping}
            multiline
            maxLength={5000}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ReactionPicker
        visible={showReactionPicker}
        title={t.chat.react}
        onSelect={(emoji) => {
          const msg = getPrimarySelected();
          if (msg && conversationId) socketService.react(msg.id, emoji, conversationId);
          clearSelection();
        }}
        onClose={() => { setShowReactionPicker(false); clearSelection(); }}
        colors={colors}
        fonts={fonts}
      />

      <ForwardSheet
        visible={showForward}
        messageId={getPrimarySelected()?.id || ''}
        title={t.chat.forward}
        onClose={() => { setShowForward(false); clearSelection(); }}
        onForwarded={() => Alert.alert(t.chat.forward, t.chat.forwarded)}
        colors={colors}
        fonts={fonts}
      />

      <MessageInfoSheet
        visible={!!infoMessage}
        message={infoMessage}
        senderName={infoMessage?.senderId === user?.id ? t.chat.you : `${otherUser?.firstName || ''}`}
        isOwn={infoMessage?.senderId === user?.id}
        onClose={() => setInfoMessage(null)}
        labels={{
          title: t.chat.messageInfo,
          sent: t.chat.sentAt,
          delivered: t.chat.deliveredAt,
          read: t.chat.readAt,
          sender: t.chat.sender,
          messageId: t.chat.messageId,
          close: t.common.cancel,
        }}
        colors={colors}
        fonts={fonts}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: -4 },
  headerInfo: { flex: 1 },
  headerName: { fontWeight: '600' },
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinnedText: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  retryBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  messagesList: { padding: Spacing.md, flexGrow: 1, paddingTop: Spacing.xl + 8 },
  selectedWrap: { borderRadius: BorderRadius.md, marginHorizontal: -4, paddingHorizontal: 4 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
