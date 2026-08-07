import React from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../../theme';

interface Props {
  visible: boolean;
  count: number;
  label: string;
  scrollDownLabel: string;
  onPress: () => void;
  colors: { primary: string; surface: string; text: string };
  fonts: { xs: number; sm: number };
}

export function NewMessagesButton({
  visible,
  count,
  label,
  scrollDownLabel,
  onPress,
  colors,
  fonts,
}: Props) {
  if (!visible) return null;

  const text = count > 0 ? (count > 1 ? `${count} ${label}` : label) : scrollDownLabel;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.primary, shadowColor: colors.primary },
        Platform.OS === 'web' && styles.buttonWeb,
      ]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
      <Text style={[styles.text, { fontSize: fonts.sm }]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: Spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    zIndex: 20,
  },
  buttonWeb: {
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
  } as object,
  text: { color: '#FFFFFF', fontWeight: '700' },
});
