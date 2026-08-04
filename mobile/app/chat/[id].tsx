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
import { PinnedBar } from '../../src/components/chat/PinnedBar';
import { PinnedHistorySheet, PinnedEntry } from '../../src/components/chat/PinnedHistorySheet';
import { UnreadDivider } from '../../src/components/chat/UnreadDivider';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
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

type ListItem =
  | { kind: 'divider' }
  | { kind: 'message'; message: Message };

interface ConversationInfo {
  participants: Array<{
    userId: string;
    lastReadAt?: string | null;
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
  const params = useLocalSearchParams<{ id: string; highlight?: string }>();
  const conversationId = normalizeId(params.id);
  const highlightParam = normalizeId(params.highlight);
  const { user } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();
  const { markConversationNotificationsRead } = useNotificationStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedEntries, setPinnedEntries] = useState<PinnedEntry[]>([]);
  const [showPinnedHistory, setShowPinnedHistory] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showUnreadDivider, setShowUnreadDivider] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
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
  const stickToBottomRef = useRef(true);
  const isJumpingRef = useRef(false);
  const unreadSessionRef = useRef(false);
  const highlightDoneRef = useRef<string | null>(null);

  const otherUser = conversation?.participants.find((p) => p.userId !== user?.id)?.user;
  const recipientOnline = otherUser?.status === 'ONLINE';

  const actionLabels = useMemo(() => {
    const selectedId = actionTarget?.id || Array.from(selectedIds)[0];
    const selectedMsg = selectedId ? messages.find((m) => m.id === selectedId) : null;
    return {
      reply: t.chat.reply,
      react: t.chat.react,
      forward: t.chat.forward,
      pin: selectedId && pinnedIds.has(selectedId) ? t.chat.unpin : t.chat.pin,
      copy: t.chat.copy,
      star: selectedMsg?.isStarred ? t.chat.unstar : t.chat.star,
      info: t.chat.info,
      delete: t.chat.delete,
    };
  }, [t, actionTarget, selectedIds, pinnedIds, messages]);

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
      const pins = ((pinsRes as { pins: Array<{ message: Record<string, unknown>; messageId: string; createdAt: string; pinnedBy?: { firstName: string } }> }).pins || []);
      const normalizedPins = pins.map((p) => normalizeMessage(p.message));
      setPinnedMessages(normalizedPins);
      setPinnedIds(new Set(pins.map((p) => p.messageId)));
      setPinnedEntries(
        pins.map((p) => ({
          messageId: p.messageId,
          message: normalizeMessage(p.message),
          pinnedAt: p.createdAt,
          pinnedByName: p.pinnedBy?.firstName,
          senderName: (p.message as { sender?: { firstName?: string } }).sender?.firstName,
        }))
      );

      const me = (convRes as ConversationInfo).participants.find((p) => p.userId === user?.id);
      // Capture unread cursor once per visit so the divider stays visible after mark-read.
      if (!unreadSessionRef.current) {
        const previousReadAt = me?.lastReadAt ?? null;
        setLastReadAt(previousReadAt);
        const hasUnread = messagesRef.current.some(
          (m) => m.senderId !== user?.id && (!previousReadAt || m.createdAt > previousReadAt)
        );
        setShowUnreadDivider(hasUnread);
        unreadSessionRef.current = true;
      }
    } catch {
      // non-blocking
    }
  }, [conversationId, user?.id]);

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

  const scrollToMessage = useCallback(async (messageId: string) => {
    if (!conversationId) return;
    isJumpingRef.current = true;
    stickToBottomRef.current = false;

    let msgs = messagesRef.current;
    let msgIndex = msgs.findIndex((m) => m.id === messageId);

    if (msgIndex < 0) {
      try {
        const around = await api.getMessagesAround(conversationId, messageId);
        const normalized = (around.messages || []).map(normalizeMessage);
        const merged = dedupeMessages([...normalized, ...messagesRef.current]).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        applyMessages(merged);
        msgs = messagesRef.current;
        msgIndex = msgs.findIndex((m) => m.id === messageId);
      } catch {
        isJumpingRef.current = false;
        return;
      }
    }

    if (msgIndex < 0) {
      isJumpingRef.current = false;
      return;
    }

    let flatIndex = msgIndex;
    if (showUnreadDivider && lastReadAt && user?.id) {
      const dividerAt = msgs.findIndex(
        (m) => m.senderId !== user.id && m.createdAt > lastReadAt
      );
      if (dividerAt >= 0 && msgIndex >= dividerAt) flatIndex += 1;
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        index: flatIndex,
        animated: true,
        viewPosition: 0.45,
      });
      setHighlightedId(messageId);
      setTimeout(() => setHighlightedId(null), 2500);
      setTimeout(() => {
        isJumpingRef.current = false;
      }, 800);
    });
  }, [conversationId, showUnreadDivider, lastReadAt, user?.id, applyMessages]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      unreadSessionRef.current = false;
      highlightDoneRef.current = null;
      stickToBottomRef.current = true;
      setLoading(true);

      const openChat = async () => {
        await loadMessages();
        await loadConversationMeta();
        socketService.joinConversation(conversationId);
        // Mark read after capturing unread cursor so divider can render for this visit.
        socketService.markRead(conversationId);
        markConversationNotificationsRead(conversationId);
      };

      openChat();

      return () => {
        socketService.leaveConversation(conversationId);
        setShowUnreadDivider(false);
        unreadSessionRef.current = false;
      };
    }, [conversationId, loadMessages, loadConversationMeta, markConversationNotificationsRead])
  );

  useEffect(() => {
    if (!highlightParam || messages.length === 0) return;
    if (highlightDoneRef.current === highlightParam) return;
    highlightDoneRef.current = highlightParam;
    scrollToMessage(highlightParam);
  }, [highlightParam, messages.length, scrollToMessage]);

  useEffect(() => {
    if (!conversationId) return;

    const unsubs = [
      socketService.on('message:new', (data: unknown) => {
        const raw = data as Record<string, unknown> & { tempId?: string };
        const msg = normalizeMessage(raw);
        updateMessages((prev) => upsertMessage(prev, msg, raw.tempId));
        if (msg.senderId !== user?.id && conversationId) {
          socketService.markDelivered(msg.id, conversationId);
          if (stickToBottomRef.current) {
            socketService.markRead(conversationId);
          }
        }
        if (stickToBottomRef.current && !isJumpingRef.current) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
        }
      }),
      socketService.on('message:reply', (data: unknown) => {
        const raw = data as Record<string, unknown> & { tempId?: string };
        const msg = normalizeMessage(raw);
        updateMessages((prev) => upsertMessage(prev, msg, raw.tempId));
        if (stickToBottomRef.current && !isJumpingRef.current) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
        }
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
          previousEmoji?: string;
          reaction?: { user: { firstName: string } };
        };
        updateMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.messageId) return m;
            if (payload.action === 'removed') {
              return {
                ...m,
                reactions: m.reactions.filter((r) => r.userId !== payload.userId),
              };
            }
            const withoutUser = m.reactions.filter((r) => r.userId !== payload.userId);
            return {
              ...m,
              reactions: [
                ...withoutUser,
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
        ? {
            id: replyTo.id,
            content: replyTo.content,
            type: replyTo.type,
            deletedForAll: replyTo.deletedForAll,
            isDeleted: replyTo.isDeleted,
            senderId: replyTo.senderId,
            sender: {
              firstName:
                replyTo.senderId === user.id
                  ? t.chat.you
                  : otherUser?.firstName || 'User',
            },
          }
        : undefined,
      reactions: [],
      createdAt: new Date().toISOString(),
      pending: true,
      status: recipientOnline ? 'SENT' : 'WAITING',
      waitingAt: recipientOnline ? undefined : new Date().toISOString(),
    };

    stickToBottomRef.current = true;
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
          setPinnedIds((prev) => {
            const next = new Set(prev);
            next.delete(message.id);
            return next;
          });
          setPinnedMessages((prev) => prev.filter((m) => m.id !== message.id));
          setPinnedEntries((prev) => prev.filter((p) => p.messageId !== message.id));
          socketService.unpinMessage(message.id, conversationId);
        } else {
          setPinnedIds((prev) => new Set(prev).add(message.id));
          setPinnedMessages((prev) => [message, ...prev.filter((m) => m.id !== message.id)]);
          setPinnedEntries((prev) => [
            {
              messageId: message.id,
              message,
              pinnedAt: new Date().toISOString(),
              pinnedByName: user?.firstName,
              senderName:
                message.senderId === user?.id
                  ? user?.firstName
                  : otherUser?.firstName,
            },
            ...prev.filter((p) => p.messageId !== message.id),
          ]);
          socketService.pinMessage(message.id, conversationId);
        }
        clearSelection();
        break;
      case 'copy':
        Clipboard.setStringAsync(message.content);
        clearSelection();
        break;
      case 'star':
        updateMessages((prev) =>
          prev.map((m) =>
            m.id === message.id ? { ...m, isStarred: !message.isStarred } : m
          )
        );
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

  const firstUnreadIndex = useMemo(() => {
    if (!lastReadAt || !user?.id) return -1;
    return messages.findIndex(
      (m) => m.senderId !== user.id && m.createdAt > lastReadAt
    );
  }, [messages, lastReadAt, user?.id]);

  const listData = useMemo((): ListItem[] => {
    if (!showUnreadDivider || firstUnreadIndex < 0) {
      return messages.map((message) => ({ kind: 'message' as const, message }));
    }
    const items: ListItem[] = [];
    messages.forEach((message, index) => {
      if (index === firstUnreadIndex) items.push({ kind: 'divider' });
      items.push({ kind: 'message', message });
    });
    return items;
  }, [messages, showUnreadDivider, firstUnreadIndex]);

  const getUserReaction = (message: Message) =>
    message.reactions.find((r) => r.userId === user?.id)?.emoji;

  const applyLocalReaction = useCallback((messageId: string, emoji: string) => {
    if (!user?.id) return;
    updateMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const mine = m.reactions.find((r) => r.userId === user.id);
        if (mine?.emoji === emoji) {
          return { ...m, reactions: m.reactions.filter((r) => r.userId !== user.id) };
        }
        return {
          ...m,
          reactions: [
            ...m.reactions.filter((r) => r.userId !== user.id),
            { emoji, userId: user.id, user: { firstName: user.firstName || 'You' } },
          ],
        };
      })
    );
  }, [user?.id, user?.firstName, updateMessages]);

  const handleReactionSelect = (emoji: string) => {
    const msg = getPrimarySelected();
    if (msg && conversationId) {
      applyLocalReaction(msg.id, emoji);
      socketService.react(msg.id, emoji, conversationId);
    }
    clearSelection();
  };

  const handleReactionChipPress = (message: Message, emoji: string) => {
    if (!conversationId) return;
    applyLocalReaction(message.id, emoji);
    socketService.react(message.id, emoji, conversationId);
  };

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
    surfaceSecondary: colors.surfaceSecondary,
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderListItem = ({ item }: { item: ListItem }) => {
    if (item.kind === 'divider') {
      return (
        <UnreadDivider
          label={t.chat.unreadMessages}
          colors={colors}
          fonts={fonts}
        />
      );
    }

    const message = item.message;
    const isOwn = message.senderId === user?.id;
    const isSelected = selectedIds.has(message.id);

    return (
      <View style={isSelected ? [styles.selectedWrap, { backgroundColor: colors.primary + '08' }] : undefined}>
        <SwipeableMessageRow
          message={message}
          isOwn={isOwn}
          isSelected={isSelected}
          isPinned={pinnedIds.has(message.id)}
          isHighlighted={highlightedId === message.id}
          colors={bubbleColors}
          fonts={fonts}
          formatTime={formatTime}
          currentUserId={user?.id}
          onPress={() => {
            if (selectionMode) toggleSelect(message);
            else if (message.failed) retryMessage(message);
          }}
          onLongPress={() => toggleSelect(message)}
          onSwipeReply={() => setReplyTo(message)}
          onReplyPress={scrollToMessage}
          onReactionPress={(emoji) => handleReactionChipPress(message, emoji)}
          deletedLabel={t.chat.deletedMessage}
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
        <PinnedBar
          pins={pinnedMessages}
          colors={{
            surfaceSecondary: colors.surfaceSecondary,
            border: colors.border,
            primary: colors.primary,
            text: colors.text,
            textTertiary: colors.textTertiary,
          }}
          fonts={fonts}
          pinLabel={t.chat.pinHeader}
          deletedLabel={t.chat.deletedMessage}
          onJumpToMessage={scrollToMessage}
          onOpenHistory={() => setShowPinnedHistory(true)}
        />
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
          data={listData}
          renderItem={renderListItem}
          keyExtractor={(item, index) =>
            item.kind === 'divider' ? `divider-${index}` : item.message.id
          }
          contentContainerStyle={styles.messagesList}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            stickToBottomRef.current =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
          }}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            if (isJumpingRef.current) return;
            if (stickToBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.45,
              });
            }, 120);
          }}
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
          senderName={
            replyTo.senderId === user?.id
              ? t.chat.you
              : otherUser?.firstName || ''
          }
          replyLabel={t.chat.reply}
          deletedLabel={t.chat.deletedMessage}
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
        currentEmoji={getPrimarySelected() ? getUserReaction(getPrimarySelected()!) : undefined}
        searchPlaceholder={t.chat.searchEmoji}
        onSelect={handleReactionSelect}
        onClose={() => { setShowReactionPicker(false); clearSelection(); }}
        colors={colors}
        fonts={fonts}
      />

      <PinnedHistorySheet
        visible={showPinnedHistory}
        title={t.chat.pinned}
        pins={pinnedEntries}
        deletedLabel={t.chat.deletedMessage}
        onClose={() => setShowPinnedHistory(false)}
        onJumpToMessage={scrollToMessage}
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
