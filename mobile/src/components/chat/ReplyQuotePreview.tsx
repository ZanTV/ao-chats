import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { getReplyPreviewText } from '../../utils/replyPreview';
import { BorderRadius, Spacing } from '../../theme';

interface ThemeColors {
  primary: string;
  text: string;
  textSecondary?: string;
  bubbleSent?: string;
  bubbleReceived?: string;
  bubbleSentText?: string;
  bubbleReceivedText?: string;
  border?: string;
  surface?: string;
  surfaceSecondary?: string;
}

interface Props {
  replyTo: NonNullable<ChatMessage['replyTo']>;
  variant: 'bubble' | 'composer';
  isOwn?: boolean;
  senderLabel?: string;
  deletedLabel?: string;
  colors: ThemeColors;
  fonts: { xs: number; sm?: number };
  onPress?: () => void;
}

function getMediaIcon(type: string): keyof typeof Ionicons.glyphMap {
  const upper = type.toUpperCase();
  if (upper === 'IMAGE') return 'image-outline';
  if (upper === 'VIDEO') return 'videocam-outline';
  if (upper === 'FILE') return 'document-outline';
  return 'chatbubble-outline';
}

export function ReplyQuotePreview({
  replyTo,
  variant,
  isOwn = false,
  senderLabel,
  deletedLabel = 'This message was deleted',
  colors,
  fonts,
  onPress,
}: Props) {
  const preview = getReplyPreviewText(replyTo, deletedLabel);
  const type = String(replyTo.type || 'TEXT').toUpperCase();
  const isMedia = ['IMAGE', 'VIDEO', 'FILE'].includes(type);
  const isComposer = variant === 'composer';

  const accent = isComposer ? colors.primary : isOwn ? 'rgba(255,255,255,0.95)' : colors.primary;
  const bg = isComposer
    ? colors.surfaceSecondary || colors.surface || '#F3F4F6'
    : isOwn
      ? 'rgba(255,255,255,0.18)'
      : `${colors.primary}14`;
  const nameColor = isComposer ? colors.primary : isOwn ? '#FFFFFF' : colors.primary;
  const textColor = isComposer
    ? colors.text
    : isOwn
      ? 'rgba(255,255,255,0.88)'
      : colors.text || colors.bubbleReceivedText || colors.textSecondary || '#374151';
  const borderColor = isComposer
    ? colors.border || `${colors.primary}22`
    : isOwn
      ? 'rgba(255,255,255,0.22)'
      : colors.border || `${colors.primary}22`;

  const content = (
    <View
      style={[
        styles.container,
        isComposer ? styles.composerContainer : styles.bubbleContainer,
        {
          backgroundColor: bg,
          borderColor,
          borderLeftColor: accent,
        },
      ]}
    >
      <View style={styles.header}>
        <Ionicons
          name={isComposer ? 'arrow-undo' : 'return-down-forward'}
          size={12}
          color={accent}
        />
        <Text style={[styles.name, { color: nameColor, fontSize: fonts.xs }]} numberOfLines={1}>
          {senderLabel || replyTo.sender?.firstName || 'Reply'}
        </Text>
      </View>
      <View style={styles.body}>
        {isMedia && (
          <Ionicons
            name={getMediaIcon(type)}
            size={13}
            color={textColor}
            style={styles.mediaIcon}
          />
        )}
        <Text
          style={[styles.preview, { color: textColor, fontSize: fonts.xs }]}
          numberOfLines={isComposer ? 1 : 2}
        >
          {preview}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.wrap}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.xs },
  container: {
    borderLeftWidth: 3.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  bubbleContainer: {
    borderTopLeftRadius: BorderRadius.sm,
  },
  composerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  name: { fontWeight: '700', flex: 1 },
  body: { flexDirection: 'row', alignItems: 'center' },
  mediaIcon: { marginRight: 4 },
  preview: { flex: 1, fontWeight: '500' },
});
