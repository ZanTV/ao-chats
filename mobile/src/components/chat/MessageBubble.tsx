import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AoMessageStatus } from './AoMessageStatus';
import { ChatMessage } from '../../utils/messages';
import { getAoMessageStatus } from '../../utils/messageStatus';
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
}

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  isSelected: boolean;
  isPinned: boolean;
  colors: ThemeColors;
  fonts: { xs: number; sm: number; md: number };
  formatTime: (iso: string) => string;
}

export function MessageBubble({
  message,
  isOwn,
  isSelected,
  isPinned,
  colors,
  fonts,
  formatTime,
}: Props) {
  const status = getAoMessageStatus(message, isOwn);
  const groupedReactions = message.reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bubbleBg = isOwn ? colors.bubbleSent : colors.bubbleReceived;
  const textColor = isOwn ? colors.bubbleSentText : colors.bubbleReceivedText;

  return (
    <View style={[styles.wrap, isOwn ? styles.wrapOwn : styles.wrapOther]}>
      {message.replyTo && (
        <View style={[styles.replyBar, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.replyName, { color: colors.primary, fontSize: fonts.xs }]}>
            {message.replyTo.sender?.firstName}
          </Text>
          <Text style={[styles.replyContent, { color: colors.textSecondary, fontSize: fonts.xs }]} numberOfLines={1}>
            {message.replyTo.content}
          </Text>
        </View>
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
          {message.deletedForAll ? 'This message was deleted' : message.content}
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
          {Object.entries(groupedReactions).map(([emoji, count]) => (
            <Text key={emoji} style={styles.reactionEmoji}>
              {emoji}
              {count > 1 ? count : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '82%' },
  wrapOwn: { alignSelf: 'flex-end' },
  wrapOther: { alignSelf: 'flex-start' },
  replyBar: { borderLeftWidth: 3, paddingLeft: Spacing.sm, marginBottom: 4, marginHorizontal: 4 },
  replyName: { fontWeight: '700' },
  replyContent: {},
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
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: -6,
    marginLeft: Spacing.sm,
    elevation: 1,
  },
  reactionEmoji: { fontSize: 14 },
});
