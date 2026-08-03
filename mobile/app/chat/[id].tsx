import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../../src/components/Avatar';
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
      bio?: string;
    };
  }>;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const messagesRef = useRef<Message[]>([]);

  const otherUser = conversation?.participants.find((p) => p.userId !== user?.id)?.user;

  const persistMessages = useCallback(async (list: Message[]) => {
    if (!conversationId || list.length === 0) return;
    messagesRef.current = list;
    await cacheData(`messages:${conversationId}`, list);
  }, [conversationId]);

  const applyMessages = useCallback((list: Message[]) => {
    const unique = dedupeMessages(list);
    setMessages(unique);
    messagesRef.current = unique;
    if (unique.length > 0) {
      cacheData(`messages:${conversationId!}`, unique);
    }
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

    setLoadError(null);

    const cached = await getCachedData<Message[]>(`messages:${conversationId}`);
    if (cached && cached.length > 0) {
      applyMessages(cached);
    }

    try {
      const msgRes = await api.getMessages(conversationId) as { messages: Record<string, unknown>[] };
      const loaded = (msgRes.messages || []).map(normalizeMessage);
      applyMessages(loaded);
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
      setPinnedMessages(
        ((pinsRes as { pins: Array<{ message: Record<string, unknown> }> }).pins || []).map(
          (p) => normalizeMessage(p.message)
        )
      );
    } catch {
      // meta load failure must not block messages
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      setLoading(true);
      loadMessages();
      loadConversationMeta();
      socketService.joinConversation(conversationId);
      socketService.markRead(conversationId);

      return () => {
        socketService.leaveConversation(conversationId);
      };
    }, [conversationId, loadMessages, loadConversationMeta])
  );

  useEffect(() => {
    if (!conversationId) return;

    const unsubs = [
      socketService.on('message:new', (data: unknown) => {
        const raw = data as Record<string, unknown> & { tempId?: string };
        const msg = normalizeMessage(raw);
        setMessages((prev) => {
          const next = upsertMessage(prev, msg, raw.tempId);
          persistMessages(next);
          return next;
        });
      }),
      socketService.on('message:error', (data: unknown) => {
        const { tempId, error } = data as { tempId?: string; error?: string };
        if (!tempId) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m))
        );
        if (error) Alert.alert(t.common.error, error);
      }),
      socketService.on('message:read', (data: unknown) => {
        const { userId: readerId, readAt } = data as { userId: string; readAt: string };
        if (readerId === user?.id) return;
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.senderId === user?.id ? { ...m, readAt: readAt || new Date().toISOString() } : m
          );
          persistMessages(next);
          return next;
        });
      }),
      socketService.on('message:react', (data: unknown) => {
        const payload = data as {
          messageId: string;
          action: string;
          emoji: string;
          userId: string;
          reaction?: { user: { firstName: string } };
        };
        setMessages((prev) => {
          const next = prev.map((m) => {
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
          });
          persistMessages(next);
          return next;
        });
      }),
      socketService.on('message:delete', (data: unknown) => {
        const { messageId, forEveryone } = data as { messageId: string; forEveryone: boolean };
        setMessages((prev) => {
          const next = forEveryone
            ? prev.map((m) =>
                m.id === messageId
                  ? { ...m, deletedForAll: true, content: 'This message was deleted' }
                  : m
              )
            : prev.filter((m) => m.id !== messageId);
          persistMessages(next);
          return next;
        });
      }),
      socketService.on('typing:start', (data: unknown) => {
        const { userId } = data as { userId: string };
        if (userId !== user?.id) setIsTyping(true);
      }),
      socketService.on('typing:stop', () => setIsTyping(false)),
    ];

    return () => unsubs.forEach((u) => u());
  }, [conversationId, user?.id, persistMessages, t.common.error]);

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
        ? { id: replyTo.id, content: replyTo.content, sender: { firstName: '' } }
        : undefined,
      reactions: [],
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => {
      const next = [...prev, optimistic];
      persistMessages(next);
      return next;
    });

    setInputText('');
    setReplyTo(null);
    socketService.stopTyping(conversationId);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const saved = normalizeMessage(
        (await api.sendMessage(conversationId, content, replyToId, tempId)) as Record<string, unknown>
      );

      setMessages((prev) => {
        const next = upsertMessage(prev, saved, tempId);
        persistMessages(next);
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === tempId ? { ...m, pending: false, failed: true } : m
        );
        persistMessages(next);
        return next;
      });
      Alert.alert(
        t.common.error,
        err instanceof ApiError ? err.message : 'Failed to send message. Tap to retry.'
      );
    }
  };

  const retryMessage = async (failedMsg: Message) => {
    if (!conversationId) return;
    const retryTempId = failedMsg.id.startsWith('temp-') ? failedMsg.id : `temp-${Date.now()}`;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedMsg.id ? { ...m, id: retryTempId, pending: true, failed: false } : m
      )
    );
    try {
      const saved = normalizeMessage(
        (await api.sendMessage(
          conversationId,
          failedMsg.content,
          failedMsg.replyToId,
          retryTempId
        )) as Record<string, unknown>
      );
      setMessages((prev) => {
        const next = upsertMessage(prev, saved, retryTempId);
        persistMessages(next);
        return next;
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id ? { ...m, pending: false, failed: true } : m
        )
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

  const showMessageActions = (message: Message) => {
    const isOwn = message.senderId === user?.id;
    const options = [
      t.chat.reply,
      t.chat.react,
      t.chat.copy,
      t.chat.pin,
      t.chat.forward,
      t.chat.deleteForMe,
      ...(isOwn ? [t.chat.deleteForEveryone] : []),
      t.common.cancel,
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: isOwn ? options.length - 2 : undefined,
        },
        (index) => handleAction(index, message, isOwn)
      );
    } else {
      Alert.alert('Message', undefined, [
        { text: t.chat.reply, onPress: () => setReplyTo(message) },
        { text: t.chat.copy, onPress: () => Clipboard.setStringAsync(message.content) },
        {
          text: t.chat.deleteForMe,
          onPress: () => socketService.deleteMessage(message.id, conversationId!, false),
          style: 'destructive',
        },
        { text: t.common.cancel, style: 'cancel' },
      ]);
    }
  };

  const handleAction = (index: number, message: Message, isOwn: boolean) => {
    switch (index) {
      case 0:
        setReplyTo(message);
        break;
      case 1:
        showReactionPicker(message);
        break;
      case 2:
        Clipboard.setStringAsync(message.content);
        break;
      case 3:
        socketService.pinMessage(message.id, conversationId!);
        break;
      case 5:
        socketService.deleteMessage(message.id, conversationId!, false);
        break;
      case 6:
        if (isOwn) socketService.deleteMessage(message.id, conversationId!, true);
        break;
    }
  };

  const showReactionPicker = (message: Message) => {
    Alert.alert(t.chat.react, undefined, [
      ...REACTIONS.map((emoji) => ({
        text: emoji,
        onPress: () => socketService.react(message.id, emoji, conversationId!),
      })),
      { text: t.common.cancel, style: 'cancel' as const },
    ]);
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id;
    const groupedReactions = item.reactions.reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <TouchableOpacity
        onLongPress={() => showMessageActions(item)}
        onPress={() => item.failed && retryMessage(item)}
        style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}
        activeOpacity={0.8}
      >
        {item.replyTo && (
          <View style={[styles.replyBar, { borderLeftColor: colors.primary }]}>
            <Text style={[styles.replyName, { color: colors.primary, fontSize: fonts.xs }]}>
              {item.replyTo.sender?.firstName}
            </Text>
            <Text
              style={[styles.replyContent, { color: colors.textSecondary, fontSize: fonts.xs }]}
              numberOfLines={1}
            >
              {item.replyTo.content}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isOwn
              ? { backgroundColor: colors.bubbleSent, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.bubbleReceived, borderBottomLeftRadius: 4 },
            item.failed && { opacity: 0.6, borderWidth: 1, borderColor: colors.danger },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: isOwn ? colors.bubbleSentText : colors.bubbleReceivedText,
                fontSize: fonts.md,
              },
            ]}
          >
            {item.deletedForAll ? 'This message was deleted' : item.content}
          </Text>
          <View style={styles.messageFooter}>
            {item.pending && (
              <ActivityIndicator size={10} color={colors.textTertiary} style={{ marginRight: 4 }} />
            )}
            {item.failed && (
              <Ionicons name="alert-circle" size={14} color={colors.danger} style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.messageTime,
                { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textTertiary, fontSize: fonts.xs },
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
            {isOwn && !item.pending && !item.failed && (
              <Ionicons
                name={item.readAt ? 'checkmark-done' : item.deliveredAt ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.readAt ? '#60A5FA' : 'rgba(255,255,255,0.7)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
        {Object.keys(groupedReactions).length > 0 && (
          <View style={[styles.reactionsBar, { backgroundColor: colors.surface }]}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <Text key={emoji} style={styles.reactionEmoji}>
                {emoji}
                {count > 1 ? count : ''}
              </Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.chatHeader,
          { backgroundColor: colors.headerBackground, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        {otherUser && (
          <>
            <Avatar
              avatarId={otherUser.avatarId}
              size={40}
              showOnline
              isOnline={otherUser.status === 'ONLINE'}
              isVerified={otherUser.isVerified}
            />
            <View style={styles.headerInfo}>
              <View style={styles.headerNameRow}>
                <Text style={[styles.headerName, { color: colors.text, fontSize: fonts.md }]}>
                  {otherUser.firstName} {otherUser.lastName}
                </Text>
                {otherUser.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                )}
              </View>
              <Text style={[styles.headerStatus, { color: colors.textSecondary, fontSize: fonts.xs }]}>
                {otherUser.isSystemAccount
                  ? otherUser.statusMessage || 'Official AO Chats Support'
                  : isTyping
                    ? t.chat.typing
                    : otherUser.status === 'ONLINE'
                      ? t.chat.online
                      : t.chat.offline}
              </Text>
            </View>
          </>
        )}
      </View>

      {pinnedMessages.length > 0 && (
        <View
          style={[
            styles.pinnedBar,
            { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border },
          ]}
        >
          <Ionicons name="pin" size={16} color={colors.primary} />
          <Text style={[styles.pinnedText, { color: colors.text, fontSize: fonts.sm }]} numberOfLines={1}>
            {pinnedMessages[0].content}
          </Text>
          <Text style={[styles.pinnedCount, { color: colors.textTertiary, fontSize: fonts.xs }]}>
            {pinnedMessages.length}
          </Text>
        </View>
      )}

      {loading && messages.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : loadError && messages.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.errorText, { color: colors.textSecondary, fontSize: fonts.sm }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setLoading(true);
              loadMessages();
            }}
          >
            <Text style={styles.retryText}>{t.common.retry}</Text>
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
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                {t.chat.sayHello}
              </Text>
            </View>
          }
        />
      )}

      {replyTo && (
        <View
          style={[
            styles.replyPreview,
            { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border },
          ]}
        >
          <View style={[styles.replyPreviewBar, { backgroundColor: colors.primary }]} />
          <View style={styles.replyPreviewContent}>
            <Text style={[styles.replyPreviewName, { color: colors.primary, fontSize: fonts.xs }]}>
              {t.chat.reply}
            </Text>
            <Text
              style={[styles.replyPreviewText, { color: colors.textSecondary, fontSize: fonts.sm }]}
              numberOfLines={1}
            >
              {replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: colors.inputBackground, color: colors.text, fontSize: fonts.md },
            ]}
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
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerStatus: {},
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinnedText: { flex: 1 },
  pinnedCount: {},
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorText: { marginTop: Spacing.md, textAlign: 'center' },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryText: { color: '#FFF', fontWeight: '600' },
  messagesList: { padding: Spacing.md, flexGrow: 1 },
  messageRow: { marginBottom: Spacing.sm, maxWidth: '80%' },
  messageRowOwn: { alignSelf: 'flex-end' },
  messageRowOther: { alignSelf: 'flex-start' },
  replyBar: { borderLeftWidth: 3, paddingLeft: Spacing.sm, marginBottom: 4 },
  replyName: { fontWeight: '600' },
  replyContent: {},
  bubble: { borderRadius: BorderRadius.lg, padding: Spacing.md - 2, paddingBottom: Spacing.sm },
  messageText: { lineHeight: 22 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  messageTime: {},
  reactionsBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: -4,
    marginLeft: Spacing.sm,
    elevation: 1,
  },
  reactionEmoji: { fontSize: 14 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: 16 },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  replyPreviewBar: { width: 3, height: 36, borderRadius: 2 },
  replyPreviewContent: { flex: 1 },
  replyPreviewName: { fontWeight: '600' },
  replyPreviewText: {},
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
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
