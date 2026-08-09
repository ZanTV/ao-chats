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
import { BorderRadius, Spacing, MessageBubbleLayout } from '../../theme';
import { MediaMessageBody } from './MediaMessageBody';
import { LinkedMessageText } from './LinkedMessageText';
import type { DetectedEntity } from '../../links/detect';
import { isMessageAttachment } from '../../attachments/types';

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
  selectionRing?: string;
  selectionOverlaySent?: string;
  selectionOverlayReceived?: string;
  jumpHighlightFrom?: string;
  jumpHighlightTo?: string;
  jumpHighlightRing?: string;
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
  editedLabel?: string;
  onEntityPress?: (entity: DetectedEntity) => void;
  onOpenViewer?: (attachment: import('../../attachments/types').MessageAttachment) => void;
  mediaLabels?: {
    download: string;
    downloading: string;
    downloadFailed: string;
    retry: string;
    open: string;
  };
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
  editedLabel = 'edited',
  onEntityPress,
  onOpenViewer,
  mediaLabels,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const highlight = useSharedValue(0);

  const displayContent = message.content;
  const attachment = isMessageAttachment(message.attachment) ? message.attachment : null;
  const isMedia = Boolean(attachment) && (message.type === 'IMAGE' || message.type === 'FILE');
  const isLongMessage = !isMedia && message.content.length > 220;
  const isCollapsed = isLongMessage && !expanded;

  useEffect(() => {
    if (isHighlighted) {
      highlight.value = withSequence(
        withTiming(1, { duration: 160 }),
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 700 })
      );
    } else {
      highlight.value = withTiming(0, { duration: 200 });
    }
  }, [isHighlighted, highlight]);

  const highlightFrom = colors.jumpHighlightFrom || MESSAGE_HIGHLIGHT_FROM;
  const highlightTo = colors.jumpHighlightTo || MESSAGE_HIGHLIGHT_TO;
  const jumpRing = colors.jumpHighlightRing || '#D97706';

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlight.value,
      [0, 1],
      [highlightFrom, highlightTo]
    ),
    transform: [{ scale: 1 + highlight.value * 0.015 }],
  }), [highlightFrom, highlightTo]);

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
  const selectionRing = colors.selectionRing || colors.primary;
  const selectionOverlay = isOwn
    ? colors.selectionOverlaySent || 'rgba(255,255,255,0.22)'
    : colors.selectionOverlayReceived || colors.primary + '22';

  return (
    <Animated.View
      style={[
        styles.wrap,
        isOwn ? styles.wrapOwn : styles.wrapOther,
        message.replyTo ? styles.wrapWithReply : null,
        compactBottom && styles.wrapCompact,
        highlightStyle,
        isSelected && {
          shadowColor: selectionRing,
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
          elevation: 8,
        },
      ]}
    >
      {isSelected ? (
        <View
          pointerEvents="none"
          style={[
            styles.selectionAccent,
            { backgroundColor: selectionRing },
            isOwn ? styles.selectionAccentOwn : styles.selectionAccentOther,
          ]}
        />
      ) : null}
      <View
        style={[
          styles.bubble,
          { backgroundColor: bubbleBg },
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          isSelected && {
            borderWidth: 2.5,
            borderColor: selectionRing,
            shadowColor: selectionRing,
            shadowOpacity: 0.38,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
          },
          isHighlighted && !isSelected && {
            borderWidth: 2,
            borderColor: jumpRing,
            shadowColor: jumpRing,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
            elevation: 5,
          },
          isPinned && styles.pinnedBubble,
          message.isForwarded && styles.forwardedBubble,
          message.failed && { opacity: 0.65, borderWidth: 1, borderColor: colors.danger },
        ]}
      >
        {isSelected ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.selectionOverlay, { backgroundColor: selectionOverlay }]}
          />
        ) : null}
        {isSelected ? (
          <View
            style={[
              styles.selectedBadge,
              { backgroundColor: selectionRing },
              isOwn ? styles.selectedBadgeOwn : styles.selectedBadgeOther,
            ]}
          >
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          </View>
        ) : null}

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

        {isMedia && attachment ? (
          <MediaMessageBody
            attachment={attachment}
            caption={displayContent}
            isOwn={isOwn}
            textColor={textColor}
            mutedColor={isOwn ? 'rgba(255,255,255,0.72)' : colors.textTertiary}
            surfaceColor={colors.surfaceSecondary || colors.surface}
            primaryColor={isOwn ? '#FFFFFF' : colors.primary}
            fonts={fonts}
            labels={mediaLabels || {
              download: 'Download',
              downloading: 'Downloading',
              downloadFailed: 'Download failed. Try again.',
              retry: 'Retry',
              open: 'Open',
            }}
            onOpenViewer={onOpenViewer}
            renderCaption={(caption) =>
              onEntityPress ? (
                <LinkedMessageText
                  text={caption}
                  color={textColor}
                  linkColor={isOwn ? '#E0F2FE' : colors.primary}
                  fontSize={fonts.md}
                  onEntityPress={onEntityPress}
                />
              ) : (
                <Text style={[styles.messageText, { color: textColor, fontSize: fonts.md }]}>{caption}</Text>
              )
            }
          />
        ) : onEntityPress ? (
          <LinkedMessageText
            text={displayContent}
            color={textColor}
            linkColor={isOwn ? '#E0F2FE' : colors.primary}
            fontSize={fonts.md}
            numberOfLines={isCollapsed ? 6 : undefined}
            onEntityPress={onEntityPress}
          />
        ) : (
          <Text
            style={[styles.messageText, { color: textColor, fontSize: fonts.md }]}
            numberOfLines={isCollapsed ? 6 : undefined}
          >
            {displayContent}
          </Text>
        )}

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
          {message.isEdited && (
            <Text style={[styles.editedLabel, { color: isOwn ? 'rgba(255,255,255,0.65)' : colors.textTertiary, fontSize: fonts.xs }]}>
              · {editedLabel}
            </Text>
          )}
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
  wrap: {
    maxWidth: MessageBubbleLayout.maxWidthPercent,
    borderRadius: BorderRadius.xl,
    padding: 2,
  },
  /** Reply quotes need a comfortable floor so short replies don't shrink the bubble. */
  wrapWithReply: {
    minWidth: MessageBubbleLayout.replyMinWidthPercent,
  },
  wrapOwn: { alignSelf: 'flex-end' },
  wrapOther: { alignSelf: 'flex-start' },
  wrapCompact: { marginBottom: -2 },
  selectionAccent: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: 4,
    borderRadius: 4,
    zIndex: 2,
  },
  selectionAccentOwn: { right: -2 },
  selectionAccentOther: { left: -2 },
  selectedBadge: {
    position: 'absolute',
    top: -6,
    zIndex: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  selectedBadgeOwn: { right: -4 },
  selectedBadgeOther: { left: -4 },
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
  selectionOverlay: {
    borderRadius: BorderRadius.xl,
  },
  pinnedBubble: { borderTopWidth: 2, borderTopColor: 'rgba(251,191,36,0.5)' },
  forwardedBubble: { borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  forwardedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinIcon: { position: 'absolute', top: 6, right: 8 },
  messageText: { lineHeight: 22 },
  seeMoreBtn: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 2 },
  seeMoreText: { fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 2 },
  time: {},
  editedLabel: { fontStyle: 'italic', marginLeft: 2 },
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
