import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { useSettingsStore } from '../stores/settingsStore';
import { useNotificationStore, AppNotification } from '../stores/notificationStore';
import { api } from '../services/api';
import { Spacing, BorderRadius } from '../theme';

const COLLAPSED_RATIO = 0.58;
const SPRING = { damping: 22, stiffness: 220 };

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function iconForType(type: AppNotification['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'FRIEND_REQUEST':
      return 'person-add-outline';
    case 'FRIEND_ACCEPTED':
      return 'people-outline';
    case 'NEW_MESSAGE':
      return 'chatbubble-outline';
    default:
      return 'notifications-outline';
  }
}

function typeLabel(type: AppNotification['type'], t: ReturnType<typeof useSettingsStore.getState>['t']) {
  switch (type) {
    case 'FRIEND_REQUEST':
      return t.notifications.friendRequest;
    case 'FRIEND_ACCEPTED':
      return t.notifications.friendAccepted;
    case 'NEW_MESSAGE':
      return t.notifications.newMessage;
    default:
      return t.notifications.title;
  }
}

export function NotificationPanel() {
  const { colors, fonts, t } = useSettingsStore();
  const {
    panelOpen,
    setPanelOpen,
    setFriendsFocus,
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    deleteNotification,
  } = useNotificationStore();

  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const collapsedHeight = screenHeight * COLLAPSED_RATIO;
  const expandedHeight = screenHeight;

  const sheetHeight = useSharedValue(collapsedHeight);
  const startHeight = useSharedValue(collapsedHeight);
  const [expanded, setExpanded] = useState(false);

  const snapTo = useCallback(
    (height: number, isFull: boolean) => {
      sheetHeight.value = withSpring(height, SPRING);
      setExpanded(isFull);
    },
    [sheetHeight]
  );

  const closePanel = useCallback(() => {
    setExpanded(false);
    setPanelOpen(false);
  }, [setPanelOpen]);

  useEffect(() => {
    if (panelOpen) {
      sheetHeight.value = collapsedHeight;
      setExpanded(false);
      refresh();
    }
  }, [panelOpen, collapsedHeight, sheetHeight, refresh]);

  const expandFull = useCallback(() => snapTo(expandedHeight, true), [snapTo, expandedHeight]);
  const collapsePartial = useCallback(() => snapTo(collapsedHeight, false), [snapTo, collapsedHeight]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startHeight.value = sheetHeight.value;
    })
    .onUpdate((e) => {
      sheetHeight.value = Math.min(
        expandedHeight,
        Math.max(0, startHeight.value - e.translationY)
      );
    })
    .onEnd((e) => {
      const current = sheetHeight.value;
      const mid = (collapsedHeight + expandedHeight) / 2;

      if (current < collapsedHeight * 0.35 || (e.velocityY > 800 && current < collapsedHeight)) {
        runOnJS(closePanel)();
        return;
      }
      if (current >= mid || e.velocityY < -600) {
        sheetHeight.value = withSpring(expandedHeight, SPRING);
        runOnJS(setExpanded)(true);
      } else {
        sheetHeight.value = withSpring(collapsedHeight, SPRING);
        runOnJS(setExpanded)(false);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
    borderTopLeftRadius: interpolate(
      sheetHeight.value,
      [collapsedHeight, expandedHeight],
      [BorderRadius.xl, 0],
      Extrapolation.CLAMP
    ),
    borderTopRightRadius: interpolate(
      sheetHeight.value,
      [collapsedHeight, expandedHeight],
      [BorderRadius.xl, 0],
      Extrapolation.CLAMP
    ),
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetHeight.value,
      [collapsedHeight, expandedHeight],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const handlePress = async (item: AppNotification) => {
    try {
      if (!item.isRead) await markRead(item.id);

      if (item.type === 'FRIEND_REQUEST') {
        closePanel();
        setFriendsFocus('requests');
        router.push('/(tabs)/friends');
        return;
      }

      if (item.type === 'NEW_MESSAGE') {
        closePanel();
        let conversationId = item.data?.conversationId;
        if (!conversationId && item.actorId) {
          const conv = await api.getOrCreateConversation(item.actorId) as { id: string };
          conversationId = conv.id;
        }
        if (conversationId) {
          router.push(`/chat/${conversationId}`);
        }
        return;
      }

      if (item.type === 'FRIEND_ACCEPTED') {
        closePanel();
        router.push('/(tabs)/friends');
      }
    } catch {
      // keep panel open on navigation errors
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[
        styles.item,
        {
          backgroundColor: item.isRead ? colors.surface : colors.primary + '10',
          borderColor: item.isRead ? colors.border : colors.primary + '35',
        },
      ]}
      onPress={() => handlePress(item)}
      activeOpacity={0.75}
    >
      {item.actor ? (
        <Avatar avatarId={item.actor.avatarId} size={48} />
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name={iconForType(item.type)} size={22} color={colors.primary} />
        </View>
      )}
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <View style={[styles.typePill, { backgroundColor: colors.primary + '12' }]}>
            <Text style={{ color: colors.primary, fontSize: fonts.xs, fontWeight: '600' }}>
              {typeLabel(item.type, t)}
            </Text>
          </View>
          {!item.isRead ? (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          ) : null}
        </View>
        <Text style={[styles.itemTitle, { color: colors.text, fontSize: fonts.sm }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.itemBodyText, { color: colors.textSecondary, fontSize: fonts.xs }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.itemTime, { color: colors.textTertiary, fontSize: fonts.xs }]}>
          {formatWhen(item.createdAt)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => deleteNotification(item.id)}
        hitSlop={8}
        style={styles.deleteBtn}
      >
        <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <Modal visible={panelOpen} animationType="fade" transparent onRequestClose={closePanel}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { backgroundColor: colors.background }, sheetStyle]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={[styles.dragZone, { paddingTop: expanded ? insets.top : Spacing.sm }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => (expanded ? collapsePartial() : expandFull())}
                style={styles.handleTouch}
              >
                <View style={[styles.handleBar, { backgroundColor: colors.textTertiary + '55' }]} />
                <Text style={[styles.dragHint, { color: colors.textTertiary, fontSize: fonts.xs }]}>
                  {expanded ? t.notifications.pullDown : t.notifications.pullUp}
                </Text>
              </TouchableOpacity>
            </View>
          </GestureDetector>

          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text, fontSize: fonts.lg }]}>
                {t.notifications.title}
              </Text>
              {unreadCount > 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: fonts.xs }}>
                  {unreadCount} {t.notifications.unread}
                </Text>
              ) : null}
            </View>
            <View style={styles.headerActions}>
              {!expanded ? (
                <TouchableOpacity onPress={expandFull} hitSlop={8}>
                  <Ionicons name="expand-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
              {unreadCount > 0 ? (
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: fonts.sm }}>
                    {t.notifications.markAllRead}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={closePanel}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading && notifications.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xl }]}
              showsVerticalScrollIndicator={expanded}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="notifications-off-outline" size={56} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, marginTop: Spacing.md }}>
                    {t.notifications.empty}
                  </Text>
                </View>
              }
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function NotificationBell({ color }: { color?: string }) {
  const { colors } = useSettingsStore();
  const { unreadCount, setPanelOpen } = useNotificationStore();

  return (
    <TouchableOpacity onPress={() => setPanelOpen(true)} style={styles.bell}>
      <Ionicons name="notifications-outline" size={24} color={color || colors.text} />
      {unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    overflow: 'hidden',
  },
  dragZone: {
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  handleTouch: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    width: '100%',
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 4,
  },
  dragHint: {
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  list: { paddingHorizontal: Spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  itemTitle: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  itemBodyText: { marginTop: 2, lineHeight: 18 },
  itemTime: { marginTop: 4 },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  bell: { padding: 4, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
});
