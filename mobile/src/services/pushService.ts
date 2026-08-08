import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from './api';
import { useNotificationStore } from '../stores/notificationStore';
import { triggerFeedback } from './feedbackService';
import { getActiveConversation } from './activeConversation';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;

/** Push is unavailable in Expo Go on Android (SDK 53+) and on web. */
function pushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.appOwnership === 'expo' && Platform.OS === 'android') return false;
  return true;
}

function getNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (!pushSupported()) {
    notificationsModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as NotificationsModule;
    if (!handlerConfigured) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerConfigured = true;
    }
    notificationsModule = mod;
    return mod;
  } catch {
    notificationsModule = null;
    return null;
  }
}

let initialized = false;

async function syncBadgeCount(count: number): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // ignore
  }
}

export async function updateAppBadge(count: number): Promise<void> {
  await syncBadgeCount(count);
}

export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications || !Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 80, 40, 80],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Friend Requests',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch {
    return null;
  }
}

function navigateFromNotification(data: Record<string, unknown>): void {
  const conversationId = data.conversationId as string | undefined;
  const requestId = data.requestId as string | undefined;

  if (conversationId) {
    router.push(`/chat/${conversationId}`);
    useNotificationStore.getState().markConversationNotificationsRead(conversationId);
    return;
  }

  if (requestId) {
    useNotificationStore.getState().setFriendsFocus('requests');
    router.push('/(tabs)/friends');
  }
}

export async function initializePushNotifications(): Promise<() => void> {
  const Notifications = getNotifications();
  if (!Notifications || initialized) return () => {};
  initialized = true;

  const token = await registerForPushNotifications();
  if (token) {
    try {
      await api.registerPushToken(token, Platform.OS);
    } catch {
      // backend may not be deployed yet
    }
  }

  const receivedSub = Notifications.addNotificationReceivedListener(async (event) => {
    const data = (event.request.content.data || {}) as Record<string, unknown>;
    const conversationId = data.conversationId as string | undefined;
    const active = getActiveConversation();

    if (conversationId && active === conversationId) {
      return;
    }

    // While app is foregrounded, Socket.IO `notification:new` owns the badge.
    // Avoid double-increment (push + socket).
    if (AppState.currentState === 'active') {
      return;
    }

    await triggerFeedback('notification');
    useNotificationStore.setState((state) => ({
      unreadCount: state.unreadCount + 1,
    }));
    await syncBadgeCount(useNotificationStore.getState().unreadCount);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
    const actionId = response.actionIdentifier;

    if (actionId === 'mark-read') {
      const notificationId = data.notificationId as string | undefined;
      if (notificationId) {
        useNotificationStore.getState().markRead(notificationId).catch(() => {});
      } else if (data.conversationId) {
        useNotificationStore
          .getState()
          .markConversationNotificationsRead(data.conversationId as string);
      }
      syncBadgeCount(useNotificationStore.getState().unreadCount);
      return;
    }

    navigateFromNotification(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
    initialized = false;
  };
}

export async function unregisterPushNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // ignore
  }
}
