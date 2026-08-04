import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { getReplyPreviewText } from '../../utils/replyPreview';
import { Spacing, BorderRadius } from '../../theme';

interface Props {
  replyTo: ChatMessage;
  senderName: string;
  replyLabel: string;
  onClose: () => void;
  onPress?: () => void;
  deletedLabel?: string;
  colors: {
    primary: string;
    textSecondary: string;
    textTertiary: string;
    surfaceSecondary: string;
    border: string;
  };
  fonts: { xs: number; sm: number };
}

export function ReplyPreviewBar({
  replyTo,
  senderName,
  replyLabel,
  onClose,
  onPress,
  deletedLabel = 'This message was deleted',
  colors,
  fonts,
}: Props) {
  const preview = getReplyPreviewText(replyTo, deletedLabel);

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border }]}>
      <View style={[styles.bar, { backgroundColor: colors.primary }]} />
      <TouchableOpacity style={styles.content} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="arrow-undo" size={16} color={colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.name, { color: colors.primary, fontSize: fonts.xs }]}>
            {senderName || replyLabel}
          </Text>
          <Text style={[styles.preview, { color: colors.textSecondary, fontSize: fonts.sm }]} numberOfLines={1}>
            {preview}
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
  bar: { width: 3.5, height: 42, borderRadius: BorderRadius.sm },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  name: { fontWeight: '700', marginBottom: 1 },
  preview: {},
});
