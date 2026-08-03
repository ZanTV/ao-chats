import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../theme';

interface ProfileSectionProps {
  title: string;
  colors: Record<string, string>;
  fonts: Record<string, number>;
  children: React.ReactNode;
}

export function ProfileSection({ title, colors, fonts, children }: ProfileSectionProps) {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: fonts.xs }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

interface ProfileFieldProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: Record<string, string>;
  fonts: Record<string, number>;
  private?: boolean;
  verified?: boolean;
}

export function ProfileField({
  icon,
  label,
  value,
  colors,
  fonts,
  private: isPrivate,
  verified,
}: ProfileFieldProps) {
  return (
    <View style={[styles.field, { borderBottomColor: colors.borderLight }]}>
      <Ionicons name={icon} size={20} color={isPrivate ? colors.textTertiary : colors.primary} />
      <View style={styles.fieldContent}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSecondary, fontSize: fonts.xs }]}>
            {label}
          </Text>
          {isPrivate && (
            <Ionicons name="lock-closed" size={12} color={colors.textTertiary} style={styles.lock} />
          )}
          {verified && (
            <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success, fontSize: fonts.xs }]}>
                Verified
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.value, { color: colors.text, fontSize: fonts.md }]}>{value}</Text>
        {isPrivate && (
          <Text style={[styles.privateHint, { color: colors.textTertiary, fontSize: fonts.xs }]}>
            Visible only to you
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldContent: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 },
  label: { fontWeight: '500' },
  lock: { marginLeft: 2 },
  value: { lineHeight: 22 },
  privateHint: { marginTop: 4, fontStyle: 'italic' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontWeight: '600' },
});
