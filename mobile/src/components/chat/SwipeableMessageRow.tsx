import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { MessageBubble } from './MessageBubble';
import { Spacing } from '../../theme';

const SWIPE_THRESHOLD = 56;
const MAX_SWIPE = 72;

interface ThemeColors {
  bubbleSent: string;
  bubbleReceived: string;
  bubbleSentText: string;
  bubbleReceivedText: string;
  primary: string;
  textSecondary: string;
  textTertiary: string;
  danger: string;
  warning: string;
  surface: string;
}

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  isSelected: boolean;
  isPinned: boolean;
  colors: ThemeColors;
  fonts: { xs: number; sm: number; md: number };
  formatTime: (iso: string) => string;
  onPress: () => void;
  onLongPress: () => void;
  onSwipeReply: () => void;
}

export function SwipeableMessageRow(props: Props) {
  const translateX = useSharedValue(0);
  const triggered = useSharedValue(false);

  const pan = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX * 0.85, MAX_SWIPE);
        if (translateX.value >= SWIPE_THRESHOLD && !triggered.value) {
          triggered.value = true;
          runOnJS(props.onSwipeReply)();
        }
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      triggered.value = false;
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyHintStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / SWIPE_THRESHOLD, 1),
    transform: [{ scale: 0.8 + Math.min(translateX.value / SWIPE_THRESHOLD, 1) * 0.2 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, rowStyle]}>
        <Animated.View style={[styles.replyHint, replyHintStyle]}>
          <Ionicons name="arrow-undo" size={20} color={props.colors.primary} />
        </Animated.View>
        <Pressable onPress={props.onPress} onLongPress={props.onLongPress} delayLongPress={280}>
          <MessageBubble
            message={props.message}
            isOwn={props.isOwn}
            isSelected={props.isSelected}
            isPinned={props.isPinned}
            colors={props.colors}
            fonts={props.fonts}
            formatTime={props.formatTime}
          />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: Spacing.sm, position: 'relative' },
  replyHint: {
    position: 'absolute',
    left: 0,
    top: '40%',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
});
