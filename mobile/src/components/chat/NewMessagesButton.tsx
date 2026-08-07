import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../../theme';

interface Props {
  count: number;
  label: string;
  onPress: () => void;
  colors: { primary: string; surface: string; text: string };
  fonts: { xs: number; sm: number };
}

export function NewMessagesButton({ count, label, onPress, colors, fonts }: Props) {
  if (count <= 0) return null;

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
      <Text style={[styles.text, { fontSize: fonts.sm }]}>
        {count > 1 ? `${count} ${label}` : label}
      </Text>
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
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  text: { color: '#FFFFFF', fontWeight: '700' },
});
