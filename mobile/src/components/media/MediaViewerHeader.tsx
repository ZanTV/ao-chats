import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { Spacing } from '../../theme';

interface Props {
  title: string;
  subtitle?: string;
  avatarId?: string;
  onBack: () => void;
  onMore: () => void;
  colors: {
    text: string;
    textSecondary: string;
    surface: string;
    border: string;
  };
  fonts: { xs: number; sm: number; md: number };
}

export function MediaViewerHeader({
  title,
  subtitle,
  avatarId,
  onBack,
  onMore,
  colors,
  fonts,
}: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={10} accessibilityRole="button">
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      {avatarId ? <Avatar avatarId={avatarId} size={36} /> : null}
      <View style={styles.meta}>
        <Text style={{ color: colors.text, fontSize: fonts.md, fontWeight: '700' }} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: colors.textSecondary, fontSize: fonts.xs }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={onMore} style={styles.more} hitSlop={10} accessibilityRole="button">
        <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
  },
  more: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
