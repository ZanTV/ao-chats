import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AoMessageStatus } from './AoMessageStatus';
import { ReplyQuotePreview } from './ReplyQuotePreview';
import { ChatMessage } from '../../utils/messages';
import { getAoMessageStatus } from '../../utils/messageStatus';
import {
  MESSAGE_HIGHLIGHT_FROM,
  MESSAGE_HIGHLIGHT_TO,
} from '../../utils/reanimatedColors';
import { BorderRadius, Spacing } from '../../theme';

interface ThemeColors {
  bubbleSent: string;
  bubbleReceived: string;
  bubbleSentText: string;
  bubbleReceivedText: string;
  primary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  danger: string;
  warning: string;
  surface: string;
  surfaceSecondary?: string;
  border?: string;
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
  compactBottom?: boolean;
  seeMoreLabel?: string;
  seeLessLabel?: string;
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
  compactBottom = false,
  seeMoreLabel = 'See more',
  seeLessLabel = 'See less',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const highlight = useSharedValue(0);

  const displayContent = message.deletedForAll ? deletedLabel : message.content;
  const isLongMessage = !message.deletedForAll && message.content.length > 220;
  const isCollapsed = isLongMessage && !expanded;

  useEffect(() => {
    if (isHighlighted) {
      highlight.value = withSequence(
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 2200 })
      );
    }
  }, [isHighlighted, highlight]);

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlight.value,
      [0, 1],
      [MESSAGE_HIGHLIGHT_FROM, MESSAGE_HIGHLIGHT_TO]
    ),
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
  const toggleLabelColor = isOwn ? 'rgba(255,255,255,0.92)' : colors.primary;

  return (
    <Animated.View
      style={[
        styles.wrap,
        isOwn ? styles.wrapOwn : styles.wrapOther,
        compactBottom && styles.wrapCompact,
        highlightStyle,
      ]}
    >
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
        {message.replyTo && (
          <ReplyQuotePreview
            replyTo={message.replyTo}
            variant="bubble"
            isOwn={isOwn}
            senderLabel={message.replyTo.sender?.firstName || 'Reply'}
            deletedLabel={deletedLabel}
            colors={colors}
            fonts={fonts}
            onPress={onReplyPress ? () => onReplyPress(message.replyTo!.id) : undefined}
          />
        )}

        {message.isForwarded && (
          <View style={styles.forwardedLabel}>
            <Ionicons name="arrow-redo-outline" size={12} color={textColor + 'AA'} />
            <Text style={{ color: textColor + 'AA', fontSize: fonts.xs, fontWeight: '600' }}>Forwarded</Text>
          </View>
        )}

        {isPinned && (
          <Ionicons name="pin" size={12} color={textColor + '99'} style={styles.pinIcon} />
        )}

        <Text
          style={[styles.messageText, { color: textColor, fontSize: fonts.md }]}
          numberOfLines={isCollapsed ? 6 : undefined}
        >
          {displayContent}
        </Text>

        {isLongMessage && (
          <Pressable
            onPress={() => setExpanded((value) => !value)}
            hitSlop={8}
            style={styles.seeMoreBtn}
          >
            <Text style={[styles.seeMoreText, { color: toggleLabelColor, fontSize: fonts.sm }]}>
              {expanded ? seeLessLabel : seeMoreLabel}
            </Text>
          </Pressable>
        )}

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
        <View style={[styles.reactionsBar, { backgroundColor: colors.surface, borderColor: colors.border || colors.surface }]}>
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
  wrap: { maxWidth: '84%', borderRadius: BorderRadius.xl, padding: 2 },
  wrapOwn: { alignSelf: 'flex-end' },
  wrapOther: { alignSelf: 'flex-start' },
  wrapCompact: { marginBottom: -2 },
  bubble: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 4,
    paddingBottom: Spacing.sm + 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bubbleOwn: { borderBottomRightRadius: 8 },
  bubbleOther: { borderBottomLeftRadius: 8 },
  pinnedBubble: { borderTopWidth: 2, borderTopColor: 'rgba(251,191,36,0.5)' },
  forwardedBubble: { borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  forwardedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinIcon: { position: 'absolute', top: 6, right: 8 },
  messageText: { lineHeight: 22 },
  seeMoreBtn: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 2 },
  seeMoreText: { fontWeight: '700' },
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  reactionEmoji: { fontSize: 14 },
});
