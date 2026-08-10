import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList as RNFlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { FlatList as GHFlatList } from 'react-native-gesture-handler';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../../src/components/Avatar';
import { SwipeableMessageRow } from '../../src/components/chat/SwipeableMessageRow';
import { MessageActionBar, MessageAction } from '../../src/components/chat/MessageActionBar';
import { ReplyPreviewBar } from '../../src/components/chat/ReplyPreviewBar';
import { ChatComposerField } from '../../src/components/chat/ChatComposerField';
import { AttachmentSheet } from '../../src/components/chat/AttachmentSheet';
import { AttachmentPreviewBar } from '../../src/components/chat/AttachmentPreviewBar';
import { DetectedContactActionSheet } from '../../src/components/chat/DetectedContactActionSheet';
import { ReactionPicker } from '../../src/components/chat/ReactionPicker';
import { AOEmojiPicker } from '../../src/components/emoji/AOEmojiPicker';
import type { PendingAttachment } from '../../src/attachments/pending';
import { messageTypeFromKindClient } from '../../src/attachments/pending';
import { uploadAttachment } from '../../src/attachments/upload';
import { seedLocalAttachment } from '../../src/attachments/storage';
import type { DetectedEntity } from '../../src/links/detect';
import { ForwardSheet } from '../../src/components/chat/ForwardSheet';
import { MessageInfoSheet } from '../../src/components/chat/MessageInfoSheet';
import { PinnedBar } from '../../src/components/chat/PinnedBar';
import { PinnedHistorySheet, PinnedEntry } from '../../src/components/chat/PinnedHistorySheet';
import { UnreadDivider } from '../../src/components/chat/UnreadDivider';
import { NewMessagesButton } from '../../src/components/chat/NewMessagesButton';
import { ChatHeaderMenu } from '../../src/components/chat/ChatHeaderMenu';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { useChatComposerStore } from '../../src/stores/chatComposerStore';
import { useTypingStore } from '../../src/stores/typingStore';
import { api } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { cacheManager, MESSAGE_PAGE_SIZE, CacheDomain } from '../../src/cache';
import { dedupeSocketHandler } from '../../src/utils/socketDedup';
import { ApiError } from '../../src/utils/validation';
import {
  ChatMessage,
  dedupeMessages,
  mergeMessagesForLoad,
  mergeRemotePageAuthority,
  normalizeMessage,
  upsertMessage,
} from '../../src/utils/messages';
import { applyStatusUpdate } from '../../src/utils/messageStatus';
import { setActiveConversation } from '../../src/services/activeConversation';
import { playIncomingChatFeedback, playOutgoingChatFeedback } from '../../src/services/feedbackService';
import * as Haptics from 'expo-haptics';
import { Spacing, BorderRadius } from '../../src/theme';
import { useChatKeyboardInset } from '../../src/hooks/useChatKeyboardInset';

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

const MessageList = Platform.OS === 'web' ? RNFlatList : GHFlatList;

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string; highlight?: string }>();
  const conversationId = normalizeId(params.id);
  const highlightParam = normalizeId(params.highlight);
  const { user } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();
  const { markConversationNotificationsRead } = useNotificationStore();
  const keyboardInset = useChatKeyboardInset();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const isOtherTyping = useTypingStore((s) =>
    conversationId ? s.isTyping(conversationId) : false
  );
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedEntries, setPinnedEntries] = useState<PinnedEntry[]>([]);
  const [showPinnedHistory, setShowPinnedHistory] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showUnreadDivider, setShowUnreadDivider] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComposerEmoji, setShowComposerEmoji] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);
  const [pendingBelowCount, setPendingBelowCount] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [activeEntity, setActiveEntity] = useState<DetectedEntity | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);

  const lastMarkReadAtRef = useRef(0);
  const flatListRef = useRef<RNFlatList<ListItem>>(null);

  const clearLocalConversationUnread = useCallback((id: string) => {
    const cached = cacheManager.get<Array<{ id: string; unreadCount?: number }>>(
      CacheDomain.CONVERSATIONS
    );
    if (!cached?.data) return;
    const next = cached.data.map((c) =>
      c.id === id ? { ...c, unreadCount: 0 } : c
    );
    cacheManager.set(CacheDomain.CONVERSATIONS, next);
  }, []);

  const markConversationReadNow = useCallback(
    (id: string, force = false) => {
      const now = Date.now();
      if (!force && now - lastMarkReadAtRef.current < 700) return;
      lastMarkReadAtRef.current = now;
      clearLocalConversationUnread(id);
      socketService.markRead(id);
      api.markConversationRead(id).catch(() => {});
      markConversationNotificationsRead(id);
    },
    [clearLocalConversationUnread, markConversationNotificationsRead]
  );
  const inputRef = useRef<TextInput>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftSaveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputTextRef = useRef('');
  const messagesRef = useRef<Message[]>([]);
  const stickToBottomRef = useRef(true);
  const isJumpingRef = useRef(false);
  const unreadSessionRef = useRef(false);
  const highlightDoneRef = useRef<string | null>(null);

  const scrollToLatest = useCallback((animated = true) => {
    stickToBottomRef.current = true;
    setPendingBelowCount(0);
    setShowScrollDown(false);
    if (conversationId) {
      markConversationReadNow(conversationId);
    }
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, [conversationId, markConversationReadNow]);

  const otherUser = conversation?.participants.find((p) => p.userId !== user?.id)?.user;
  const recipientOnline = otherUser?.status === 'ONLINE';

  const actionLabels = useMemo(() => {
    const selectedId = actionTarget?.id || Array.from(selectedIds)[0];
    const selectedMsg = selectedId ? messages.find((m) => m.id === selectedId) : null;
    return {
      reply: t.chat.reply,
      react: t.chat.react,
      forward: t.chat.forward,
      edit: t.chat.edit,
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
    await cacheManager.saveMessages(conversationId, list);
  }, [conversationId]);

  const applyMessages = useCallback((list: Message[]) => {
    const unique = dedupeMessages(list).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    setMessages(unique);
    messagesRef.current = unique;
    if (unique.length > 0 && conversationId) {
      cacheManager.saveMessages(conversationId, unique).catch(() => {});
    }
  }, [conversationId]);

  const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      persistMessages(next);
      if (conversationId) {
        useChatComposerStore.getState().syncPendingFromMessages(conversationId, next);
      }
      return next;
    });
  }, [persistMessages, conversationId]);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoadError(null);
    nextCursorRef.current = null;
    hasMoreRef.current = true;

    const local = await cacheManager.getLocalMessages(conversationId);
    const pending = useChatComposerStore.getState().getPendingMessages(conversationId);

    if (local.length > 0) {
      applyMessages(mergeMessagesForLoad(local, pending));
      setLoading(false);
    }

    try {
      const msgRes = await api.getMessages(conversationId, undefined, MESSAGE_PAGE_SIZE);
      const remote = (msgRes.messages || []).map(normalizeMessage);
      nextCursorRef.current = msgRes.nextCursor ?? null;
      hasMoreRef.current = msgRes.hasMore ?? remote.length >= MESSAGE_PAGE_SIZE;

      await cacheManager.pruneMissingFromRemotePage(conversationId, remote).catch(() => {});
      applyMessages(mergeRemotePageAuthority(local, remote, pending));
    } catch (err) {
      if (!messagesRef.current.length) {
        const message =
          err instanceof ApiError && (err.code === 'DB_ERROR' || err.code === 'INTERNAL_ERROR')
            ? t.home.loadChatsFailed
            : err instanceof Error
              ? err.message
              : t.common.error;
        setLoadError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, applyMessages, t.common.error]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMoreRef.current || !nextCursorRef.current) return;
    setLoadingOlder(true);
    const cursor = nextCursorRef.current;
    try {
      const msgRes = await api.getMessages(conversationId, cursor, MESSAGE_PAGE_SIZE);
      const older = (msgRes.messages || []).map(normalizeMessage);
      nextCursorRef.current = msgRes.nextCursor ?? null;
      hasMoreRef.current = msgRes.hasMore ?? older.length >= MESSAGE_PAGE_SIZE;

      if (older.length > 0) {
        applyMessages(dedupeMessages([...older, ...messagesRef.current]));
      } else {
        hasMoreRef.current = false;
      }
    } catch {
      // keep existing messages
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, applyMessages]);

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

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    setActionTarget(null);
  }, []);

  const goBack = useCallback(() => {
    if (selectionMode) {
      clearSelection();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [selectionMode, clearSelection]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

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

  const selectMessageForAction = (message: Message) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setSelectedIds(new Set([message.id]));
    setSelectionMode(true);
    setActionTarget(message);
  };

  const handleSwipeReply = useCallback((message: Message) => {
    clearSelection();
    setReplyTo(message);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [clearSelection]);

  const scrollToMessage = useCallback(async (messageId: string) => {
    if (!conversationId || !messageId) return;
    isJumpingRef.current = true;
    stickToBottomRef.current = false;
    setShowPinnedHistory(false);

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
      } catch (err) {
        isJumpingRef.current = false;
        const missing =
          err instanceof ApiError &&
          (err.code === 'NOT_FOUND' ||
            /not found/i.test(err.message) ||
            err.message === 'Message not found');
        if (missing) {
          // Stale pin — drop from local list and ask backend to unpin
          setPinnedIds((prev) => {
            const next = new Set(prev);
            next.delete(messageId);
            return next;
          });
          setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
          setPinnedEntries((prev) => prev.filter((p) => p.messageId !== messageId));
          try {
            socketService.unpinMessage(messageId, conversationId);
            await api.unpinMessage(conversationId, messageId);
          } catch {
            // ignore — message already gone
          }
          Alert.alert(t.chat.pinned, t.chat.messageUnavailable);
        } else {
          Alert.alert(t.common.error, err instanceof Error ? err.message : t.common.error);
        }
        return;
      }
    }

    if (msgIndex < 0) {
      isJumpingRef.current = false;
      Alert.alert(t.chat.pinned, t.chat.messageUnavailable);
      return;
    }

    let flatIndex = msgIndex;
    if (showUnreadDivider && lastReadAt && user?.id) {
      const dividerAt = msgs.findIndex(
        (m) => m.senderId !== user.id && m.createdAt > lastReadAt
      );
      if (dividerAt >= 0 && msgIndex >= dividerAt) flatIndex += 1;
    }

    // Place target roughly in the upper-middle viewport (below header/pin bar).
    const runScroll = () => {
      flatListRef.current?.scrollToIndex({
        index: flatIndex,
        animated: true,
        viewPosition: 0.32,
        viewOffset: 12,
      });
      setHighlightedId(messageId);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      setTimeout(() => setHighlightedId(null), 1800);
      setTimeout(() => {
        isJumpingRef.current = false;
      }, 900);
    };

    // Wait one frame so list data (if just loaded) is committed.
    requestAnimationFrame(() => {
      requestAnimationFrame(runScroll);
    });
  }, [conversationId, showUnreadDivider, lastReadAt, user?.id, applyMessages, t]);

  const handleUnpinFromList = useCallback(async (messageId: string) => {
    if (!conversationId || !messageId) return;

    const prevIds = new Set(pinnedIds);
    const prevMessages = pinnedMessages;
    const prevEntries = pinnedEntries;

    // Optimistic UI — remove immediately
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    setPinnedEntries((prev) => prev.filter((p) => p.messageId !== messageId));
    setUnpinningId(messageId);

    try {
      socketService.unpinMessage(messageId, conversationId);
      await api.unpinMessage(conversationId, messageId);
      if (prevEntries.length <= 1) setShowPinnedHistory(false);
    } catch {
      setPinnedIds(prevIds);
      setPinnedMessages(prevMessages);
      setPinnedEntries(prevEntries);
      Alert.alert(t.common.error, t.chat.unpinFailed);
    } finally {
      setUnpinningId(null);
    }
  }, [conversationId, pinnedIds, pinnedMessages, pinnedEntries, t]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      unreadSessionRef.current = false;
      highlightDoneRef.current = null;
      setPendingBelowCount(0);
      setShowScrollDown(false);
      stickToBottomRef.current = true;
      setActiveConversation(conversationId);

      const openChat = async () => {
        const composerStore = useChatComposerStore.getState();
        const hasLocalMessages = (await cacheManager.getLocalMessages(conversationId)).length > 0;
        if (!hasLocalMessages) setLoading(true);

        await composerStore.loadAll();
        const draft = composerStore.getDraft(conversationId);
        if (draft) setInputText(draft);

        await Promise.all([loadMessages(), loadConversationMeta()]);

        if (!highlightParam) {
          scrollToLatest(false);
        }
        socketService.joinConversation(conversationId);
        // Optimistic local badge clear + socket + HTTP (works even if socket is down)
        markConversationReadNow(conversationId, true);
      };

      void openChat();

      return () => {
        if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
        if (conversationId) {
          useChatComposerStore.getState().setDraft(conversationId, inputTextRef.current);
          useChatComposerStore.getState().syncPendingFromMessages(conversationId, messagesRef.current);
        }
        setActiveConversation(null);
        socketService.leaveConversation(conversationId);
        setShowUnreadDivider(false);
        unreadSessionRef.current = false;
      };
    }, [
      conversationId,
      loadMessages,
      loadConversationMeta,
      markConversationReadNow,
      highlightParam,
      scrollToLatest,
    ])
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
      socketService.on('message:new', dedupeSocketHandler((data: unknown) => {
        const raw = data as Record<string, unknown> & { tempId?: string };
        const msg = normalizeMessage(raw);
        updateMessages((prev) => upsertMessage(prev, msg, raw.tempId));
        if (msg.senderId !== user?.id && conversationId) {
          socketService.markDelivered(msg.id, conversationId);
          playIncomingChatFeedback().catch(() => {});
          if (!stickToBottomRef.current) {
            setPendingBelowCount((count) => count + 1);
          } else {
            markConversationReadNow(conversationId);
          }
        }
        if (stickToBottomRef.current && !isJumpingRef.current) {
          setTimeout(() => scrollToLatest(true), 80);
        }
      })),
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
        const { messageId, forEveryone, userId: deleterId, conversationId: clearedConv } = data as {
          messageId: string;
          forEveryone: boolean;
          userId: string;
          conversationId?: string;
        };
        if (clearedConv && clearedConv !== conversationId) return;

        const shouldHide = forEveryone || deleterId === user?.id;
        if (!shouldHide) return;

        updateMessages((prev) => prev.filter((m) => m.id !== messageId));
        if (conversationId) {
          cacheManager.deleteMessages(conversationId, [messageId]).catch(() => {});
        }
        if (forEveryone) {
          setPinnedIds((prev) => {
            if (!prev.has(messageId)) return prev;
            const next = new Set(prev);
            next.delete(messageId);
            return next;
          });
          setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
          setPinnedEntries((prev) => prev.filter((p) => p.messageId !== messageId));
        }
      }),
      socketService.on('message:edit', (data: unknown) => {
        const updated = normalizeMessage(data as Record<string, unknown>);
        updateMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, ...updated, pending: false, failed: false } : m))
        );
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
      socketService.on('conversation:cleared', (data: unknown) => {
        const { conversationId: clearedId } = data as { conversationId?: string };
        if (clearedId !== conversationId) return;
        applyMessages([]);
        setPinnedMessages([]);
        setPinnedIds(new Set());
        setPinnedEntries([]);
        setShowUnreadDivider(false);
        if (conversationId) {
          cacheManager.clearConversationMessages(conversationId).catch(() => {});
        }
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [conversationId, user?.id, updateMessages, loadConversationMeta, loadMessages, t.common.error, scrollToLatest, applyMessages, markConversationReadNow]);

  const handleSend = async () => {
    if (!conversationId || !user) return;
    if (uploading) return;
    const content = inputText.trim();
    const pending = pendingAttachment;
    if (!content && !pending) return;

    const replyToId = replyTo?.id;
    const tempId = `temp-${Date.now()}`;

    if (pending) {
      setUploading(true);
      setUploadFailed(false);
      setUploadPercent(0);
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      try {
        const uploaded = await uploadAttachment(
          pending,
          conversationId,
          (p) => setUploadPercent(p.percent),
          controller.signal
        );
        await seedLocalAttachment({
          attachmentId: uploaded.id,
          storageKey: uploaded.storageKey,
          localUri: pending.localUri,
          fileSize: uploaded.fileSize,
          downloadedAt: new Date().toISOString(),
          mimeType: uploaded.mimeType,
          fileName: uploaded.fileName,
        });

        const msgType = messageTypeFromKindClient(uploaded.kind);
        const optimistic: Message = {
          id: tempId,
          content,
          senderId: user.id,
          type: msgType,
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
          attachment: uploaded,
        };

        stickToBottomRef.current = true;
        updateMessages((prev) => [...prev, optimistic]);
        playOutgoingChatFeedback().catch(() => {});
        setInputText('');
        setPendingAttachment(null);
        setUploadPercent(null);
        setUploading(false);
        if (conversationId) {
          useChatComposerStore.getState().clearDraft(conversationId);
        }
        setReplyTo(null);
        socketService.stopTyping(conversationId);
        scrollToLatest(true);

        const saved = normalizeMessage(
          (await api.sendMessage(conversationId, content, replyToId, tempId, {
            type: msgType,
            attachment: uploaded,
          })) as Record<string, unknown>
        );
        updateMessages((prev) => upsertMessage(prev, saved, tempId));
      } catch (err) {
        setUploading(false);
        if (err instanceof ApiError && err.code === 'CANCELLED') {
          setUploadPercent(null);
          return;
        }
        setUploadFailed(true);
        Alert.alert(
          t.common.error,
          err instanceof ApiError ? err.message : t.chat.uploadFailed
        );
      } finally {
        uploadAbortRef.current = null;
      }
      return;
    }

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
    playOutgoingChatFeedback().catch(() => {});
    setInputText('');
    if (conversationId) {
      useChatComposerStore.getState().clearDraft(conversationId);
    }
    setReplyTo(null);
    socketService.stopTyping(conversationId);
    scrollToLatest(true);

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
    if (conversationId) {
      if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
      draftSaveTimeout.current = setTimeout(() => {
        useChatComposerStore.getState().setDraft(conversationId, text);
      }, 300);
    }
    if (!conversationId) return;
    socketService.startTyping(conversationId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socketService.stopTyping(conversationId), 2000);
  };

  const getPrimarySelected = (): Message | null => {
    const id = actionTarget?.id || Array.from(selectedIds)[0];
    return messages.find((m) => m.id === id) || null;
  };

  const performDeleteMessages = useCallback(async (forEveryone: boolean) => {
    if (!conversationId) return;
    const ids = new Set(selectedIds);
    if (actionTarget?.id) ids.add(actionTarget.id);
    const idList = Array.from(ids).filter(Boolean);
    if (idList.length === 0) return;

    const snapshot = messagesRef.current.filter((m) => idList.includes(m.id));
    const pinSnapshot = {
      ids: new Set(pinnedIds),
      messages: pinnedMessages,
      entries: pinnedEntries,
    };

    // Optimistic UI + local cache removal (instant, no refresh)
    updateMessages((prev) => prev.filter((m) => !idList.includes(m.id)));
    cacheManager.deleteMessages(conversationId, idList).catch(() => {});
    if (forEveryone) {
      setPinnedIds((prev) => {
        const next = new Set(prev);
        idList.forEach((id) => next.delete(id));
        return next;
      });
      setPinnedMessages((prev) => prev.filter((m) => !idList.includes(m.id)));
      setPinnedEntries((prev) => prev.filter((p) => !idList.includes(p.messageId)));
    }
    clearSelection();
    setShowDeleteConfirm(false);
    setShowDeleteMenu(false);

    const failures: string[] = [];
    await Promise.all(
      idList.map(async (id) => {
        if (id.startsWith('temp-')) return;
        try {
          // REST persists + fans out Socket.IO (emitMessageDeleted)
          await api.deleteMessage(id, forEveryone);
        } catch {
          failures.push(id);
        }
      })
    );

    if (failures.length > 0) {
      const restore = snapshot.filter((m) => failures.includes(m.id));
      if (restore.length > 0) {
        updateMessages((prev) =>
          dedupeMessages([...prev, ...restore]).sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt)
          )
        );
        cacheManager.saveMessages(conversationId, restore).catch(() => {});
      }
      if (forEveryone) {
        setPinnedIds(pinSnapshot.ids);
        setPinnedMessages(pinSnapshot.messages);
        setPinnedEntries(pinSnapshot.entries);
      }
      Alert.alert(t.common.error, t.chat.deleteMessageFailed);
    }
  }, [
    conversationId,
    selectedIds,
    actionTarget,
    pinnedIds,
    pinnedMessages,
    pinnedEntries,
    updateMessages,
    clearSelection,
    t,
  ]);

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
        setShowComposerEmoji(false);
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
      case 'edit':
        if (isOwn && !message.isEdited && message.type === 'TEXT' && !message.pending) {
          setEditingMessage(message);
          setEditText(message.content);
          setReplyTo(null);
        }
        clearSelection();
        break;
      case 'delete': {
        const selected = messages.filter((m) => selectedIds.has(m.id));
        const allOwn =
          selected.length > 0 &&
          selected.every((m) => m.senderId === user?.id && !m.id.startsWith('temp-'));
        if (allOwn || (selected.length === 0 && isOwn && !message.id.startsWith('temp-'))) {
          setShowDeleteMenu(true);
        } else {
          setDeleteForEveryone(false);
          setShowDeleteConfirm(true);
        }
        break;
      }
    }
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !conversationId || !editText.trim()) return;
    const content = editText.trim();
    updateMessages((prev) =>
      prev.map((m) =>
        m.id === editingMessage.id ? { ...m, content, isEdited: true, editedAt: new Date().toISOString() } : m
      )
    );
    socketService.editMessage(editingMessage.id, conversationId, content);
    setEditingMessage(null);
    setEditText('');
  };

  const confirmClearChat = useCallback(async () => {
    if (!conversationId || clearingChat) return;
    setClearingChat(true);
    try {
      applyMessages([]);
      setPinnedMessages([]);
      setPinnedIds(new Set());
      setPinnedEntries([]);
      setShowUnreadDivider(false);
      setReplyTo(null);
      setEditingMessage(null);
      setEditText('');
      clearSelection();
      await cacheManager.clearConversationMessages(conversationId);
      useChatComposerStore.getState().clearDraft(conversationId);
      await api.clearConversation(conversationId);
      setShowClearConfirm(false);
    } catch (err) {
      await loadMessages();
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.common.error);
    } finally {
      setClearingChat(false);
    }
  }, [conversationId, clearingChat, applyMessages, clearSelection, loadMessages, t]);

  const chatMenuItems = useMemo(
    () => [
      {
        key: 'clear',
        label: t.chat.clearChat,
        icon: 'trash-outline' as const,
        destructive: true,
        onPress: () => setShowClearConfirm(true),
      },
    ],
    [t]
  );

  const deleteMenuItems = useMemo(
    () => [
      {
        key: 'for-me',
        label: t.chat.deleteForMe,
        icon: 'trash-outline' as const,
        destructive: true,
        onPress: () => {
          void performDeleteMessages(false);
        },
      },
      {
        key: 'for-everyone',
        label: t.chat.deleteForEveryone,
        icon: 'trash-bin-outline' as const,
        destructive: true,
        onPress: () => {
          void performDeleteMessages(true);
        },
      },
    ],
    [t, performDeleteMessages]
  );

  const primarySelected = getPrimarySelected();
  const hiddenActions: MessageAction[] = [];
  if (primarySelected) {
    const isOwnSelected = primarySelected.senderId === user?.id;
    if (!isOwnSelected || primarySelected.isEdited || primarySelected.type !== 'TEXT' || primarySelected.pending) {
      hiddenActions.push('edit');
    }
  }

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
    text: colors.text,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    danger: colors.danger,
    warning: colors.warning,
    surface: colors.surface,
    surfaceSecondary: colors.surfaceSecondary,
    border: colors.border,
    selectionRing: colors.selectionRing,
    selectionOverlaySent: colors.selectionOverlaySent,
    selectionOverlayReceived: colors.selectionOverlayReceived,
    jumpHighlightFrom: colors.jumpHighlightFrom,
    jumpHighlightTo: colors.jumpHighlightTo,
    jumpHighlightRing: colors.jumpHighlightRing,
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderListItem = ({ item, index }: { item: ListItem; index: number }) => {
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
    const prevMessage =
      index > 0 && listData[index - 1]?.kind === 'message'
        ? (listData[index - 1] as { kind: 'message'; message: Message }).message
        : null;
    const compactBottom =
      !!prevMessage &&
      prevMessage.senderId === message.senderId &&
      Math.abs(
        new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()
      ) < 120_000;

    return (
      <View
        style={
          isSelected
            ? [
                styles.selectedWrap,
                {
                  backgroundColor: colors.selectionWrap,
                  borderColor: colors.selectionRing,
                  borderWidth: 1.5,
                },
              ]
            : undefined
        }
      >
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
          onLongPress={() => selectMessageForAction(message)}
          onSwipeReply={() => handleSwipeReply(message)}
          onReplyPress={scrollToMessage}
          onReactionPress={(emoji) => handleReactionChipPress(message, emoji)}
          onEntityPress={(entity) => setActiveEntity(entity)}
          onOpenViewer={(attachment) => {
            router.push(`/media/${attachment.id}` as any);
          }}
          mediaLabels={{
            download: t.chat.download,
            downloading: t.chat.downloading,
            downloadFailed: t.chat.downloadFailed,
            retry: t.chat.retry,
            open: t.chat.openFile,
          }}
          deletedLabel={t.chat.deletedMessage}
          compactBottom={compactBottom}
          seeMoreLabel={t.chat.seeMore}
          seeLessLabel={t.chat.seeLess}
          editedLabel={t.chat.edited}
        />
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.chatHeader, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name={selectionMode ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        {otherUser && !selectionMode && (
          <>
            <TouchableOpacity
              style={styles.headerProfileTap}
              onPress={() =>
                router.push({
                  pathname: '/friend/[id]',
                  params: {
                    id: otherUser.id,
                    conversationId: String(conversationId || ''),
                  },
                } as any)
              }
              accessibilityLabel={t.friendInfo.title}
            >
              <Avatar
                avatarId={otherUser.avatarId}
                imageUrl={(otherUser as { avatarUrl?: string }).avatarUrl}
                imageVersion={(otherUser as { avatarVersion?: number }).avatarVersion}
                size={40}
                showOnline
                isOnline={otherUser.status === 'ONLINE'}
                isVerified={otherUser.isVerified}
              />
              <View style={styles.headerInfo}>
                <Text style={[styles.headerName, { color: colors.text, fontSize: fonts.md }]}>
                  {otherUser.firstName} {otherUser.lastName}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: fonts.xs }}>
                  {otherUser.isSystemAccount
                    ? otherUser.statusMessage || 'Official AO Chats Support'
                    : isOtherTyping || isTyping ? t.chat.typing : otherUser.status === 'ONLINE' ? t.chat.online : t.chat.offline}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowChatMenu(true)}
              style={styles.headerMenuBtn}
              accessibilityLabel={t.home.chatOptions}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
            </TouchableOpacity>
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
        hiddenActions={hiddenActions}
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
        <View style={styles.listWrap}>
        <MessageList
          ref={flatListRef}
          data={listData}
          style={styles.messageList}
          renderItem={renderListItem}
          keyExtractor={(item, index) =>
            item.kind === 'divider' ? `divider-${index}` : item.message.id
          }
          contentContainerStyle={styles.messagesList}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          directionalLockEnabled
          overScrollMode="never"
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const atBottom =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
            stickToBottomRef.current = atBottom;
            setShowScrollDown(!atBottom);
            if (atBottom) {
              setPendingBelowCount(0);
              if (conversationId) markConversationReadNow(conversationId);
            }
            if (contentOffset.y < 60 && hasMoreRef.current && !loadingOlder) {
              loadOlderMessages();
            }
          }}
          scrollEventThrottle={16}
          maintainVisibleContentPosition={
            Platform.OS === 'web' ? undefined : { minIndexForVisible: 0 }
          }
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
          ListHeaderComponent={
            loadingOlder ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: Spacing.sm }} />
            ) : null
          }
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ color: colors.textSecondary }}>{t.chat.sayHello}</Text>
            </View>
          }
        />
        <NewMessagesButton
          visible={showScrollDown || pendingBelowCount > 0}
          count={pendingBelowCount}
          label={t.notifications.newMessage}
          scrollDownLabel={t.chat.scrollDown}
          onPress={() => scrollToLatest(true)}
          colors={colors}
          fonts={fonts}
        />
        </View>
      )}

      {editingMessage && (
        <View style={[styles.editBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm, flex: 1 }} numberOfLines={1}>
            {t.chat.editMessage}
          </Text>
          <TouchableOpacity onPress={() => { setEditingMessage(null); setEditText(''); }} hitSlop={8}>
            <Text style={{ color: colors.danger, fontSize: fonts.sm, fontWeight: '600' }}>{t.chat.cancelEdit}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.composerWrap,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'web' ? keyboardInset : 0,
          },
        ]}
      >
        {replyTo && !editingMessage && (
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

        {pendingAttachment && !editingMessage && (
          <AttachmentPreviewBar
            file={pendingAttachment}
            uploadPercent={uploadPercent}
            uploading={uploading}
            failed={uploadFailed}
            onClear={() => {
              if (uploading) return;
              setPendingAttachment(null);
              setUploadFailed(false);
              setUploadPercent(null);
            }}
            onCancelUpload={() => {
              uploadAbortRef.current?.abort();
              setUploading(false);
              setUploadPercent(null);
            }}
            onRetry={() => {
              setUploadFailed(false);
              handleSend();
            }}
            colors={colors}
            fonts={fonts}
            labels={{
              uploading: t.chat.uploading,
              failed: t.chat.uploadFailed,
              retry: t.chat.retry,
              cancel: t.common.cancel,
            }}
          />
        )}

        <View style={styles.inputBar}>
          <ChatComposerField
            ref={inputRef}
            value={editingMessage ? editText : inputText}
            onChangeText={editingMessage ? setEditText : handleTyping}
            placeholder={
              editingMessage
                ? t.chat.editMessage
                : pendingAttachment
                  ? t.chat.addCaption
                  : t.chat.typeMessage
            }
            emojiOpen={showComposerEmoji}
            canSubmit={
              editingMessage
                ? !!editText.trim()
                : !!inputText.trim() || !!pendingAttachment
            }
            submitMode={editingMessage ? 'save' : 'send'}
            onAttachPress={
              editingMessage
                ? undefined
                : () => {
                    Keyboard.dismiss();
                    setShowComposerEmoji(false);
                    setShowAttachmentSheet(true);
                  }
            }
            attachDisabled={uploading}
            onEmojiPress={() => {
              if (showComposerEmoji) {
                setShowComposerEmoji(false);
                requestAnimationFrame(() => inputRef.current?.focus());
                return;
              }
              Keyboard.dismiss();
              setShowComposerEmoji(true);
            }}
            onSubmit={editingMessage ? handleSaveEdit : handleSend}
            onFocus={() => {
              if (showComposerEmoji) setShowComposerEmoji(false);
              if (stickToBottomRef.current) {
                requestAnimationFrame(() => scrollToLatest(true));
              }
            }}
            onContentHeightChange={() => {
              if (stickToBottomRef.current) {
                requestAnimationFrame(() => scrollToLatest(false));
              }
            }}
            colors={colors}
            fonts={fonts}
            emojiAccessibilityLabel={t.chat.searchEmoji}
            attachAccessibilityLabel={t.chat.attach}
            sendAccessibilityLabel={editingMessage ? t.chat.saveEdit : t.chat.send}
            inputAccessibilityLabel={editingMessage ? t.chat.editMessage : t.chat.typeMessage}
          />
        </View>

        <AOEmojiPicker
          visible={showComposerEmoji}
          presentation="panel"
          closeOnSelect={false}
          searchPlaceholder={t.chat.searchEmoji}
          emptyLabel={t.chat.noEmojiFound}
          recentLabel={t.chat.recentEmojis}
          premiumLockedLabel={t.chat.aoPremium}
          onSelect={(emoji) => {
            if (editingMessage) {
              setEditText((prev) => `${prev}${emoji}`);
            } else {
              handleTyping(`${inputTextRef.current}${emoji}`);
            }
          }}
          onClose={() => {
            setShowComposerEmoji(false);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          colors={colors}
          fonts={fonts}
        />
      </View>

      <ReactionPicker
        visible={showReactionPicker}
        title={t.chat.react}
        currentEmoji={getPrimarySelected() ? getUserReaction(getPrimarySelected()!) : undefined}
        searchPlaceholder={t.chat.searchEmoji}
        emptyLabel={t.chat.noEmojiFound}
        recentLabel={t.chat.recentEmojis}
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
        emptyLabel={t.chat.noPinned}
        unpinLabel={t.chat.unpin}
        onClose={() => setShowPinnedHistory(false)}
        onJumpToMessage={scrollToMessage}
        onUnpin={handleUnpinFromList}
        unpinningId={unpinningId}
        colors={{ ...colors, pressHighlight: colors.pressHighlight }}
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

      <AttachmentSheet
        visible={showAttachmentSheet}
        onClose={() => setShowAttachmentSheet(false)}
        onSelect={(file) => {
          setPendingAttachment(file);
          setUploadFailed(false);
          setUploadPercent(null);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onError={(message) => Alert.alert(t.common.error, message)}
        colors={colors}
        fonts={fonts}
        labels={{
          title: t.chat.attachmentTitle,
          gallery: t.chat.gallery,
          document: t.chat.document,
          link: t.chat.linkOther,
          recent: t.chat.recentMedia,
          cancel: t.common.cancel,
        }}
      />

      <DetectedContactActionSheet
        visible={!!activeEntity}
        entity={activeEntity}
        onClose={() => setActiveEntity(null)}
        labels={{
          open: t.chat.openLink,
          openEmail: t.chat.openEmail,
          openLocation: t.chat.openLocation,
          call: t.chat.call,
          copy: t.chat.copy,
          cancel: t.common.cancel,
          copiedLink: t.chat.linkCopied,
          copiedEmail: t.chat.emailCopied,
          copiedPhone: t.chat.phoneCopied,
          copiedLocation: t.chat.locationCopied,
        }}
        colors={colors}
        fonts={fonts}
        onCopied={(message) => {
          setCopyToast(message);
          setTimeout(() => setCopyToast(null), 1600);
        }}
      />

      {copyToast ? (
        <View style={styles.copyToast} pointerEvents="none">
          <Text style={styles.copyToastText}>{copyToast}</Text>
        </View>
      ) : null}

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

      <ChatHeaderMenu
        visible={showChatMenu}
        title={t.chat.chatSettings}
        items={chatMenuItems}
        onClose={() => setShowChatMenu(false)}
        topOffset={Platform.OS === 'web' ? 72 : 60}
        colors={colors}
        fonts={fonts}
      />

      <ChatHeaderMenu
        visible={showDeleteMenu}
        title={t.chat.delete}
        items={deleteMenuItems}
        onClose={() => setShowDeleteMenu(false)}
        topOffset={Platform.OS === 'web' ? 72 : 60}
        colors={colors}
        fonts={fonts}
      />

      <ConfirmDialog
        visible={showClearConfirm}
        title={t.chat.clearChat}
        message={t.chat.clearChatConfirm}
        confirmLabel={t.chat.clearChat}
        cancelLabel={t.common.cancel}
        destructive
        onConfirm={() => { void confirmClearChat(); }}
        onCancel={() => {
          if (!clearingChat) setShowClearConfirm(false);
        }}
        colors={colors}
        fonts={fonts}
      />

      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t.chat.delete}
        message={
          deleteForEveryone
            ? t.chat.deleteForEveryone
            : t.chat.deleteForMe
        }
        confirmLabel={t.chat.delete}
        cancelLabel={t.common.cancel}
        destructive
        onConfirm={() => { void performDeleteMessages(deleteForEveryone); }}
        onCancel={() => setShowDeleteConfirm(false)}
        colors={colors}
        fonts={fonts}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: -4 },
  headerMenuBtn: { padding: Spacing.xs },
  headerInfo: { flex: 1 },
  headerProfileTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
  },
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
  messagesList: { padding: Spacing.md, flexGrow: 1, paddingTop: Spacing.lg },
  messageList: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as object)
      : null),
  },
  listWrap: { flex: 1, position: 'relative', minHeight: 0 },
  selectedWrap: {
    borderRadius: BorderRadius.lg,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  copyToast: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  copyToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
