import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../theme';

type Props = {
  visible: boolean;
  message: string;
  onDone: () => void;
  colors: {
    surface: string;
    text: string;
    textSecondary: string;
    success: string;
    overlay: string;
  };
  fonts: { sm: number; md: number };
  durationMs?: number;
};

/**
 * Short non-blocking success toast — only mount after server save is confirmed.
 */
export function ProfileSaveSuccessToast({
  visible,
  message,
  onDone,
  colors,
  fonts,
  durationMs = 1600,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) return;

    opacity.setValue(0);
    scale.setValue(0.85);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();

    const hide = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, durationMs);

    return () => clearTimeout(hide);
  }, [visible, durationMs, onDone, opacity, scale]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]} pointerEvents="none">
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={[styles.checkWrap, { backgroundColor: colors.success + '18' }]}>
            <Ionicons name="checkmark" size={36} color={colors.success} />
          </View>
          <Text style={[styles.message, { color: colors.text, fontSize: fonts.md }]}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    minWidth: 200,
    maxWidth: 280,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
