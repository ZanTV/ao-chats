import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { ReplyQuotePreview } from './ReplyQuotePreview';
import { Spacing } from '../../theme';

interface Props {
  replyTo: ChatMessage;
  senderName: string;
  replyLabel: string;
  onClose: () => void;
  onPress?: () => void;
  deletedLabel?: string;
  colors: {
    primary: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    surface: string;
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
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: colors.primary }]} />
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.75}
      >
        <ReplyQuotePreview
          replyTo={{
            id: replyTo.id,
            content: replyTo.content,
            type: replyTo.type,
            deletedForAll: replyTo.deletedForAll,
            isDeleted: replyTo.isDeleted,
            senderId: replyTo.senderId,
            sender: { firstName: senderName || replyLabel },
          }}
          variant="composer"
          senderLabel={senderName || replyLabel}
          deletedLabel={deletedLabel}
          colors={colors}
          fonts={fonts}
          onPress={onPress}
        />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  bar: { width: 3.5, alignSelf: 'stretch', borderRadius: 4 },
  content: { flex: 1 },
});
