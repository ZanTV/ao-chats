import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { getReplyPreviewText } from '../../utils/replyPreview';
import { Spacing, BorderRadius } from '../../theme';

interface Props {
  pins: ChatMessage[];
  colors: {
    surfaceSecondary: string;
    border: string;
    primary: string;
    text: string;
    textTertiary: string;
  };
  fonts: { xs: number; sm: number };
  pinLabel: string;
  deletedLabel?: string;
  onJumpToMessage: (messageId: string) => void;
  onOpenHistory: () => void;
}

export function PinnedBar({
  pins,
  colors,
  fonts,
  pinLabel,
  deletedLabel = 'This message was deleted',
  onJumpToMessage,
  onOpenHistory,
}: Props) {
  const [index, setIndex] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    setIndex(0);
  }, [pins.length, pins[0]?.id]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % pins.length);
  }, [pins.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + pins.length) % pins.length);
  }, [pins.length]);

  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.35;
    })
    .onEnd((e) => {
      if (e.translationX < -40 && pins.length > 1) runOnJS(goNext)();
      else if (e.translationX > 40 && pins.length > 1) runOnJS(goPrev)();
      translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
    });

  const swipeUp = Gesture.Pan()
    .activeOffsetY([-24, 24])
    .failOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationY < -36) runOnJS(onOpenHistory)();
    });

  const composed = Gesture.Simultaneous(pan, swipeUp);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (pins.length === 0) return null;
  const safeIndex = Math.min(index, pins.length - 1);
  const current = pins[safeIndex] ?? pins[0];
  const preview = getReplyPreviewText(current, deletedLabel);

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.bar, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
        <Pressable
          style={[styles.pinIcon, { backgroundColor: colors.primary + '18' }]}
          onPress={onOpenHistory}
          hitSlop={8}
        >
          <Ionicons name="pin" size={14} color={colors.primary} />
        </Pressable>

        <Animated.View style={[styles.content, animStyle]}>
          <Pressable onPress={onOpenHistory} hitSlop={4}>
            <Text style={[styles.label, { color: colors.primary, fontSize: fonts.xs }]}>{pinLabel}</Text>
          </Pressable>
          <Pressable onPress={() => onJumpToMessage(current.id)}>
            <Text style={[styles.preview, { color: colors.text, fontSize: fonts.sm }]} numberOfLines={1}>
              {preview}
            </Text>
          </Pressable>
        </Animated.View>

        {pins.length > 1 && (
          <View style={[styles.counter, { backgroundColor: colors.primary + '14' }]}>
            <Text style={{ color: colors.primary, fontSize: fonts.xs, fontWeight: '700' }}>
              {safeIndex + 1} / {pins.length}
            </Text>
          </View>
        )}
        <Pressable onPress={onOpenHistory} hitSlop={8}>
          <Ionicons name="chevron-up" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  label: { fontWeight: '700', marginBottom: 1 },
  preview: { fontWeight: '500' },
  counter: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
});
