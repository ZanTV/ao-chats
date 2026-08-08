import React, { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { MessageBubble } from './MessageBubble';
import { Spacing } from '../../theme';
import { clampOpacity } from '../../utils/reanimatedColors';

const SWIPE_THRESHOLD = 52;
const MAX_SWIPE = 76;

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
  selectionRing?: string;
  selectionOverlaySent?: string;
  selectionOverlayReceived?: string;
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
}

function SwipeableMessageRowNative(props: Props) {
  const translateX = useSharedValue(0);
  const replyArmed = useSharedValue(false);

  const fireReply = useCallback(() => {
    props.onSwipeReply();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [props]);

  const pan = Gesture.Pan()
    .activeOffsetX(22)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX * 0.88, MAX_SWIPE);
        replyArmed.value = translateX.value >= SWIPE_THRESHOLD;
      } else if (e.translationX <= 0) {
        translateX.value = 0;
        replyArmed.value = false;
      }
    })
    .onEnd((e) => {
      if (e.translationX >= SWIPE_THRESHOLD) {
        runOnJS(fireReply)();
      }
      translateX.value = withSpring(0, { damping: 22, stiffness: 280 });
      replyArmed.value = false;
    });

  const longPress = Gesture.LongPress()
    .minDuration(280)
    .maxDistance(10)
    .onStart(() => {
      runOnJS(props.onLongPress)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(props.onPress)();
  });

  const touch = Gesture.Exclusive(longPress, tap);
  const composed = Gesture.Simultaneous(touch, pan);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyHintStyle = useAnimatedStyle(() => {
    const progress = clampOpacity(translateX.value / SWIPE_THRESHOLD);
    return {
      opacity: progress,
      transform: [{ scale: 0.84 + progress * 0.16 }],
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.row, props.compactBottom && styles.rowCompact, rowStyle]}>
        <Animated.View style={[styles.replyHint, replyHintStyle]}>
          <Ionicons name="arrow-undo" size={20} color={props.colors.primary} />
        </Animated.View>
        <View style={styles.pressWrap}>
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
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SwipeableMessageRow(props: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.row, props.compactBottom && styles.rowCompact]}>
        <MessageBubble {...props} />
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
    left: 4,
    top: '38%',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.14)',
  },
});
