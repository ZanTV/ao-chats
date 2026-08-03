import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { BorderRadius, Spacing } from '../../theme';

export type MessageAction =
  | 'reply'
  | 'react'
  | 'forward'
  | 'pin'
  | 'copy'
  | 'star'
  | 'info'
  | 'delete';

interface ActionItem {
  key: MessageAction;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  selectedCount: number;
  labels: Record<MessageAction, string>;
  onAction: (action: MessageAction) => void;
  onClose: () => void;
  colors: {
    primary: string;
    text: string;
    textSecondary: string;
    danger: string;
    surface: string;
    border: string;
  };
  fonts: { xs: number; sm: number };
}

const ACTIONS: ActionItem[] = [
  { key: 'reply', icon: 'arrow-undo-outline', label: 'reply' },
  { key: 'react', icon: 'happy-outline', label: 'react' },
  { key: 'forward', icon: 'arrow-redo-outline', label: 'forward' },
  { key: 'pin', icon: 'pin-outline', label: 'pin' },
  { key: 'copy', icon: 'copy-outline', label: 'copy' },
  { key: 'star', icon: 'star-outline', label: 'star' },
  { key: 'info', icon: 'information-circle-outline', label: 'info' },
  { key: 'delete', icon: 'trash-outline', label: 'delete', destructive: true },
];

export function MessageActionBar({
  visible,
  selectedCount,
  labels,
  onAction,
  onClose,
  colors,
  fonts,
}: Props) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOutUp.duration(180)}
      style={[styles.container, { borderColor: colors.border }]}
    >
      <View style={[styles.glass, { backgroundColor: Platform.OS === 'web' ? colors.surface : 'rgba(255,255,255,0.92)' }]}>
        <View style={styles.topRow}>
          <Text style={[styles.counter, { color: colors.text, fontSize: fonts.sm }]}>
            {selectedCount} selected
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.actionBtn, { backgroundColor: colors.primary + '10' }]}
              onPress={() => onAction(action.key)}
            >
              <Ionicons
                name={action.icon}
                size={22}
                color={action.destructive ? colors.danger : colors.primary}
              />
              <Text
                style={{
                  color: action.destructive ? colors.danger : colors.text,
                  fontSize: fonts.xs,
                  fontWeight: '600',
                  marginTop: 4,
                }}
              >
                {labels[action.key]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 100,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  glass: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  counter: { fontWeight: '700' },
  actions: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    minWidth: 72,
  },
});
