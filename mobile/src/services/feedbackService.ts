import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../stores/settingsStore';
import { playReceivedChatSound, playSentChatSound } from '../utils/chatSounds';

type FeedbackKind = 'chat' | 'notification';

async function canUseHaptics(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function playOutgoingChatFeedback(): Promise<void> {
  const { chatSound, chatVibration } = useSettingsStore.getState();
  if (chatVibration) {
    if (await canUseHaptics()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (Platform.OS !== 'web') {
      Vibration.vibrate(15);
    }
  }
  if (chatSound) {
    await playSentChatSound();
  }
}

export async function playIncomingChatFeedback(): Promise<void> {
  const { chatSound, chatVibration } = useSettingsStore.getState();
  if (chatVibration) {
    if (await canUseHaptics()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 25, 40, 25]);
    }
  }
  if (chatSound) {
    await playReceivedChatSound();
  }
}

export async function playNotificationFeedback(): Promise<void> {
  const { notificationSound, notificationVibration } = useSettingsStore.getState();
  if (notificationVibration) {
    if (await canUseHaptics()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 80, 40, 80]);
    }
  }
  if (notificationSound && Platform.OS !== 'web') {
    if (await canUseHaptics()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }
}

export async function triggerFeedback(kind: FeedbackKind): Promise<void> {
  if (kind === 'chat') {
    await playIncomingChatFeedback();
  } else {
    await playNotificationFeedback();
  }
}
