import React, { useCallback, useRef, useState } from 'react';
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

/** Must move this far right before reply can activate */
const SWIPE_THRESHOLD = 56;
const MAX_SWIPE = 80;
/** Dead-zone before pan activates (px). Higher = scroll-friendlier */
const ACTIVE_X = 28;
/**
 * If finger moves this far vertically before horizontal activation,
 * the pan fails and FlatList scroll wins.
 */
const FAIL_Y = 10;
/** Horizontal must dominate vertical (dx > dy * ratio) */
const HORIZONTAL_RATIO = 1.35;

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
  jumpHighlightFrom?: string;
  jumpHighlightTo?: string;
  jumpHighlightRing?: string;
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
  onEntityPress?: (entity: import('../../links/detect').DetectedEntity) => void;
  onOpenViewer?: (attachment: import('../../attachments/types').MessageAttachment) => void;
  mediaLabels?: {
    download: string;
    downloading: string;
    downloadFailed: string;
    retry: string;
    open: string;
  };
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
      onEntityPress={props.onEntityPress}
      onOpenViewer={props.onOpenViewer}
      mediaLabels={props.mediaLabels}
      currentUserId={props.currentUserId}
      deletedLabel={props.deletedLabel}
      compactBottom={props.compactBottom}
      seeMoreLabel={props.seeMoreLabel}
      seeLessLabel={props.seeLessLabel}
      editedLabel={props.editedLabel}
    />
  );
}

function isHorizontalReplyGesture(dx: number, dy: number): boolean {
  if (dx < SWIPE_THRESHOLD) return false;
  return Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO;
}

function SwipeableMessageRowNative(props: Props) {
  const translateX = useSharedValue(0);
  const onSwipeReplyRef = useRef(props.onSwipeReply);
  onSwipeReplyRef.current = props.onSwipeReply;

  const fireReply = useCallback(() => {
    onSwipeReplyRef.current();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const pan = Gesture.Pan()
    .activeOffsetX([ACTIVE_X, 9999])
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onUpdate((e) => {
      // Extra guard: if vertical starts winning mid-gesture, collapse swipe UI
      if (Math.abs(e.translationY) > Math.abs(e.translationX) * 0.9 && e.translationX < ACTIVE_X + 8) {
        translateX.value = withSpring(0, { damping: 24, stiffness: 320 });
        return;
      }
      translateX.value = Math.min(Math.max(e.translationX, 0) * 0.88, MAX_SWIPE);
    })
    .onEnd((e) => {
      if (isHorizontalReplyGesture(e.translationX, e.translationY)) {
        runOnJS(fireReply)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
    })
    .onFinalize(() => {
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
          delayLongPress={280}
          style={styles.pressWrap}
        >
          <BubbleContent {...props} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

type AxisLock = 'none' | 'h' | 'v';

/**
 * Web/mobile-browser swipe-to-reply.
 * Vertical scroll always wins once the gesture is classified as vertical.
 */
function SwipeableMessageRowWeb(props: Props) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lockRef = useRef<AxisLock>('none');
  const [tx, setTx] = useState(0);

  const reset = () => {
    startRef.current = null;
    lockRef.current = 'none';
    setTx(0);
  };

  const handlers = {
    onTouchStart: (e: { nativeEvent: { pageX: number; pageY: number } }) => {
      startRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      lockRef.current = 'none';
      setTx(0);
    },
    onTouchMove: (e: { nativeEvent: { pageX: number; pageY: number } }) => {
      if (!startRef.current || lockRef.current === 'v') return;
      const dx = e.nativeEvent.pageX - startRef.current.x;
      const dy = e.nativeEvent.pageY - startRef.current.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (lockRef.current === 'none') {
        if (ady > FAIL_Y && ady >= adx * 0.85) {
          lockRef.current = 'v';
          setTx(0);
          return;
        }
        if (dx > ACTIVE_X && adx > ady * HORIZONTAL_RATIO) {
          lockRef.current = 'h';
        } else {
          return;
        }
      }

      if (lockRef.current === 'h') {
        setTx(Math.min(Math.max(dx, 0) * 0.88, MAX_SWIPE));
      }
    },
    onTouchEnd: () => {
      if (lockRef.current === 'h' && tx >= SWIPE_THRESHOLD) {
        props.onSwipeReply();
      }
      reset();
    },
    onTouchCancel: reset,
  };

  const progress = Math.min(1, tx / SWIPE_THRESHOLD);

  return (
    <View
      style={[styles.row, props.compactBottom && styles.rowCompact, { transform: [{ translateX: tx }] }]}
      {...handlers}
    >
      <View
        pointerEvents="none"
        style={[
          styles.replyHint,
          { opacity: progress, transform: [{ scale: 0.82 + progress * 0.18 }] },
        ]}
      >
        <Ionicons name="arrow-undo" size={20} color={props.colors.primary} />
      </View>
      <Pressable
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        delayLongPress={280}
        style={styles.pressWrap}
      >
        <BubbleContent {...props} />
      </Pressable>
    </View>
  );
}

export function SwipeableMessageRow(props: Props) {
  if (Platform.OS === 'web') {
    return <SwipeableMessageRowWeb {...props} />;
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
