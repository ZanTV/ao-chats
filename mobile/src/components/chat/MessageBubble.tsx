import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AoMessageStatus } from './AoMessageStatus';
import { ChatMessage } from '../../utils/messages';
import { getAoMessageStatus } from '../../utils/messageStatus';
import { getReplyPreviewText } from '../../utils/replyPreview';
import { BorderRadius, Spacing } from '../../theme';

interface ThemeColors {
  bubbleSent: string;
  bubbleReceived: string;
  bubbleSentText: string;
  bubbleReceivedText: string;
  primary: string;
  textSecondary: string;
  textTertiary: string;
  danger: string;
  warning: string;
  surface: string;
  surfaceSecondary?: string;
}

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  isSelected: boolean;
  isPinned: boolean;
  isHighlighted?: boolean;
  colors: ThemeColors;
  fonts: { xs: number; sm: number; md: number };
  formatTime: (iso: string) => string;
  onReplyPress?: (messageId: string) => void;
  onReactionPress?: (emoji: string) => void;
  currentUserId?: string;
  deletedLabel?: string;
}

function ReplyQuote({
  replyTo,
  isOwn,
  colors,
  fonts,
  onPress,
  deletedLabel = 'This message was deleted',
}: {
  replyTo: NonNullable<ChatMessage['replyTo']>;
  isOwn: boolean;
  colors: ThemeColors;
  fonts: { xs: number; sm: number };
  onPress?: () => void;
  deletedLabel?: string;
}) {
  const accent = isOwn ? 'rgba(255,255,255,0.9)' : colors.primary;
  const bg = isOwn ? 'rgba(255,255,255,0.14)' : (colors.surfaceSecondary || colors.surface);
  const nameColor = isOwn ? '#E0E7FF' : colors.primary;
  const textColor = isOwn ? 'rgba(255,255,255,0.82)' : colors.textSecondary;
  const preview = getReplyPreviewText(replyTo, deletedLabel);
  const type = String(replyTo.type || '').toUpperCase();
  const isMedia = ['IMAGE', 'VIDEO', 'FILE'].includes(type);

  const content = (
    <View style={[styles.replyContainer, { backgroundColor: bg, borderLeftColor: accent }]}>
      <View style={styles.replyHeader}>
        <Ionicons name="return-down-forward" size={12} color={accent} />
        <Text style={[styles.replyName, { color: nameColor, fontSize: fonts.xs }]} numberOfLines={1}>
          {replyTo.sender?.firstName || 'Reply'}
        </Text>
      </View>
      <View style={styles.replyBody}>
        {isMedia && (
          <Ionicons
            name={
              type === 'IMAGE'
                ? 'image-outline'
                : type === 'VIDEO'
                  ? 'videocam-outline'
                  : 'document-outline'
            }
            size={13}
            color={textColor}
            style={{ marginRight: 4 }}
          />
        )}
        <Text style={[styles.replyContent, { color: textColor, fontSize: fonts.xs }]} numberOfLines={2}>
          {preview}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.replyWrap}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.replyWrap}>{content}</View>;
}

export function MessageBubble({
  message,
  isOwn,
  isSelected,
  isPinned,
  isHighlighted,
  colors,
  fonts,
  formatTime,
  onReplyPress,
  onReactionPress,
  currentUserId,
  deletedLabel = 'This message was deleted',
}: Props) {
  const highlight = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlight.value = withSequence(
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 2200 })
      );
    }
  }, [isHighlighted, highlight]);

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(37, 99, 235, ${highlight.value * 0.22})`,
  }));

  const status = getAoMessageStatus(message, isOwn);
  const groupedReactions = message.reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.userId === currentUserId) acc[r.emoji].mine = true;
    return acc;
  }, {} as Record<string, { count: number; mine: boolean }>);

  const bubbleBg = isOwn ? colors.bubbleSent : colors.bubbleReceived;
  const textColor = isOwn ? colors.bubbleSentText : colors.bubbleReceivedText;

  return (
    <Animated.View style={[styles.wrap, isOwn ? styles.wrapOwn : styles.wrapOther, highlightStyle]}>
      {message.replyTo && (
        <ReplyQuote
          replyTo={message.replyTo}
          isOwn={isOwn}
          colors={colors}
          fonts={fonts}
          deletedLabel={deletedLabel}
          onPress={onReplyPress ? () => onReplyPress(message.replyTo!.id) : undefined}
        />
      )}

      <View
        style={[
          styles.bubble,
          { backgroundColor: bubbleBg },
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          isSelected && { borderWidth: 2, borderColor: colors.primary },
          isPinned && styles.pinnedBubble,
          message.isForwarded && styles.forwardedBubble,
          message.failed && { opacity: 0.65, borderWidth: 1, borderColor: colors.danger },
        ]}
      >
        {message.isForwarded && (
          <View style={styles.forwardedLabel}>
            <Ionicons name="arrow-redo-outline" size={12} color={textColor + 'AA'} />
            <Text style={{ color: textColor + 'AA', fontSize: fonts.xs, fontWeight: '600' }}>Forwarded</Text>
          </View>
        )}

        {isPinned && (
          <Ionicons name="pin" size={12} color={textColor + '99'} style={styles.pinIcon} />
        )}

        <Text style={[styles.messageText, { color: textColor, fontSize: fonts.md }]}>
          {message.deletedForAll ? deletedLabel : message.content}
        </Text>

        <View style={styles.footer}>
          {message.isStarred && (
            <Ionicons name="star" size={12} color={colors.warning} style={{ marginRight: 4 }} />
          )}
          <Text style={[styles.time, { color: isOwn ? 'rgba(255,255,255,0.72)' : colors.textTertiary, fontSize: fonts.xs }]}>
            {formatTime(message.createdAt)}
          </Text>
          {status && (
            <View style={styles.statusWrap}>
              <AoMessageStatus status={status} readColor="#93C5FD" />
            </View>
          )}
        </View>
      </View>

      {Object.keys(groupedReactions).length > 0 && (
        <View style={[styles.reactionsBar, { backgroundColor: colors.surface }]}>
          {Object.entries(groupedReactions).map(([emoji, meta]) => (
            <Pressable
              key={emoji}
              style={[styles.reactionChip, meta.mine && { borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => onReactionPress?.(emoji)}
            >
              <Text style={styles.reactionEmoji}>
                {emoji}
                {meta.count > 1 ? meta.count : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '82%', borderRadius: BorderRadius.lg, padding: 2 },
  wrapOwn: { alignSelf: 'flex-end' },
  wrapOther: { alignSelf: 'flex-start' },
  replyWrap: { marginBottom: 4, marginHorizontal: 2 },
  replyContainer: {
    borderLeftWidth: 3.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 3,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  replyName: { fontWeight: '700', flexShrink: 1 },
  replyBody: { flexDirection: 'row', alignItems: 'center' },
  replyContent: { lineHeight: 16, flex: 1 },
  bubble: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleOwn: { borderBottomRightRadius: 6 },
  bubbleOther: { borderBottomLeftRadius: 6 },
  pinnedBubble: { borderTopWidth: 2, borderTopColor: 'rgba(251,191,36,0.5)' },
  forwardedBubble: { borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  forwardedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinIcon: { position: 'absolute', top: 6, right: 8 },
  messageText: { lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 2 },
  time: {},
  statusWrap: { marginLeft: 4 },
  reactionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: -6,
    marginLeft: Spacing.sm,
    elevation: 1,
  },
  reactionChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  reactionEmoji: { fontSize: 14 },
});
