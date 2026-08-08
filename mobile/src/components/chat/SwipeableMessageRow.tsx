import React, { useCallback, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
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

const SWIPE_THRESHOLD = 40;
const MAX_SWIPE = 76;
const ACTIVE_X = 12;

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

function BubbleContent(props: Props) {
  return (
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
  );
}

function SwipeableMessageRowNative(props: Props) {
  const translateX = useSharedValue(0);
  const onSwipeReplyRef = useRef(props.onSwipeReply);
  onSwipeReplyRef.current = props.onSwipeReply;

  const fireReply = useCallback(() => {
    onSwipeReplyRef.current();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // Pan only — tap/long-press stay on Pressable so scroll + swipe don't fight.
  const pan = Gesture.Pan()
    .activeOffsetX([ACTIVE_X, 9999])
    .failOffsetY([-18, 18])
    .onUpdate((e) => {
      translateX.value = Math.min(Math.max(e.translationX, 0) * 0.92, MAX_SWIPE);
    })
    .onEnd((e) => {
      if (e.translationX >= SWIPE_THRESHOLD || e.velocityX > 650) {
        runOnJS(fireReply)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyHintStyle = useAnimatedStyle(() => {
    const progress = clampOpacity(translateX.value / SWIPE_THRESHOLD);
    return {
      opacity: progress,
      transform: [{ scale: 0.82 + progress * 0.18 }],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, props.compactBottom && styles.rowCompact, rowStyle]}>
        <Animated.View pointerEvents="none" style={[styles.replyHint, replyHintStyle]}>
          <Ionicons name="arrow-undo" size={20} color={props.colors.primary} />
        </Animated.View>
        <Pressable
          onPress={props.onPress}
          onLongPress={props.onLongPress}
          delayLongPress={250}
          style={styles.pressWrap}
        >
          <BubbleContent {...props} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export function SwipeableMessageRow(props: Props) {
  if (Platform.OS === 'web') {
    return (
      <Pressable
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        delayLongPress={250}
        style={[styles.row, props.compactBottom && styles.rowCompact]}
      >
        <BubbleContent {...props} />
      </Pressable>
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
