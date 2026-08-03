import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { Spacing, BorderRadius } from '../../theme';

interface Props {
  replyTo: ChatMessage;
  senderName: string;
  replyLabel: string;
  onClose: () => void;
  onPress?: () => void;
  colors: {
    primary: string;
    textSecondary: string;
    textTertiary: string;
    surfaceSecondary: string;
    border: string;
  };
  fonts: { xs: number; sm: number };
}

export function ReplyPreviewBar({ replyTo, senderName, replyLabel, onClose, onPress, colors, fonts }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border }]}>
      <View style={[styles.bar, { backgroundColor: colors.primary }]} />
      <TouchableOpacity style={styles.content} onPress={onPress} disabled={!onPress}>
        <Ionicons name="arrow-undo" size={16} color={colors.primary} />
        <View style={styles.textWrap}>
          <Text style={[styles.name, { color: colors.primary, fontSize: fonts.xs }]}>{senderName || replyLabel}</Text>
          <Text style={[styles.preview, { color: colors.textSecondary, fontSize: fonts.sm }]} numberOfLines={1}>
            {replyTo.content}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} hitSlop={8}>
        <Ionicons name="close" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  bar: { width: 3, height: 40, borderRadius: 2 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  textWrap: { flex: 1 },
  name: { fontWeight: '700' },
  preview: {},
});
