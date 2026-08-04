import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Spacing } from '../../theme';

interface Props {
  label: string;
  colors: { primary: string; textSecondary: string; border: string };
  fonts: { xs: number };
}

export function UnreadDivider({ label, colors, fonts }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <View style={[styles.badge, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]}>
        <Text style={[styles.label, { color: colors.primary, fontSize: fonts.xs }]}>{label}</Text>
      </View>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.sm,
  },
  label: { fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
});
