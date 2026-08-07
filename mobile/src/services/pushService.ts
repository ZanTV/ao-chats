import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from './api';
import { useNotificationStore } from '../stores/notificationStore';
import { triggerFeedback } from './feedbackService';
import { getActiveConversation } from './activeConversation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let initialized = false;

async function syncBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
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
  if (Platform.OS === 'web' || !Device.isDevice) return null;

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
  if (initialized) return () => {};
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
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // ignore
  }
}
