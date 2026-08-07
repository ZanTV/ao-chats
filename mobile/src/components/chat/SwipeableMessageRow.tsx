import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
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
import { clampOpacity } from '../../utils/reanimatedColors';

const SWIPE_THRESHOLD = 56;
const MAX_SWIPE = 72;

interface ThemeColors {
  bubbleSent: string;
  bubbleReceived: string;
  bubbleSentText: string;
  bubbleReceivedText: string;
  primary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  danger: string;
  warning: string;
  surface: string;
  surfaceSecondary?: string;
  border?: string;
}

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  isSelected: boolean;
  isPinned: boolean;
  isHighlighted?: boolean;
  colors: ThemeColors;
  fonts: { xs: number; sm: number; md: number };
  formatTime: (iso: string) => string;
  onPress: () => void;
  onLongPress: () => void;
  onSwipeReply: () => void;
  onReplyPress?: (messageId: string) => void;
  onReactionPress?: (emoji: string) => void;
  currentUserId?: string;
  deletedLabel?: string;
  compactBottom?: boolean;
  seeMoreLabel?: string;
  seeLessLabel?: string;
  editedLabel?: string;
  pressHighlight?: string;
}

function MessageRowContent(props: Props) {
  const highlight = props.pressHighlight || props.colors.primary + '12';

  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      delayLongPress={280}
      style={({ pressed, hovered }) => [
        styles.pressWrap,
        pressed && { backgroundColor: highlight },
        Platform.OS === 'web' && hovered && { backgroundColor: highlight },
      ]}
    >
      <MessageBubble
        message={props.message}
        isOwn={props.isOwn}
        isSelected={props.isSelected}
        isPinned={props.isPinned}
        isHighlighted={props.isHighlighted}
        colors={props.colors}
        fonts={props.fonts}
        formatTime={props.formatTime}
        onReplyPress={props.onReplyPress}
        onReactionPress={props.onReactionPress}
        currentUserId={props.currentUserId}
        deletedLabel={props.deletedLabel}
        compactBottom={props.compactBottom}
        seeMoreLabel={props.seeMoreLabel}
        seeLessLabel={props.seeLessLabel}
        editedLabel={props.editedLabel}
      />
    </Pressable>
  );
}

function SwipeableMessageRowNative(props: Props) {
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

  const replyHintStyle = useAnimatedStyle(() => {
    const progress = clampOpacity(translateX.value / SWIPE_THRESHOLD);
    return {
      opacity: progress,
      transform: [{ scale: 0.8 + progress * 0.2 }],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, props.compactBottom && styles.rowCompact, rowStyle]}>
        <Animated.View style={[styles.replyHint, replyHintStyle]}>
          <Ionicons name="arrow-undo" size={20} color={props.colors.primary} />
        </Animated.View>
        <MessageRowContent {...props} />
      </Animated.View>
    </GestureDetector>
  );
}

export function SwipeableMessageRow(props: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.row, props.compactBottom && styles.rowCompact]}>
        <MessageRowContent {...props} />
      </View>
    );
  }

  return <SwipeableMessageRowNative {...props} />;
}

const styles = StyleSheet.create({
  pressWrap: { borderRadius: 16 },
  row: { marginBottom: Spacing.sm, position: 'relative' },
  rowCompact: { marginBottom: Spacing.xs },
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
