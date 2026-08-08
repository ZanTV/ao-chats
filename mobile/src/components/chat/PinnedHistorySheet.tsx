import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { getReplyPreviewText } from '../../utils/replyPreview';
import { Spacing, BorderRadius } from '../../theme';

export interface PinnedEntry {
  messageId: string;
  message: ChatMessage;
  pinnedAt: string;
  pinnedByName?: string;
  senderName?: string;
}

interface Props {
  visible: boolean;
  title: string;
  pins: PinnedEntry[];
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  unpinningId?: string | null;
  deletedLabel?: string;
  emptyLabel?: string;
  unpinLabel?: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    primary: string;
    danger?: string;
    pressHighlight?: string;
  };
  fonts: { xs: number; sm: number; md: number };
}

function typeIcon(type?: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'IMAGE':
      return 'image-outline';
    case 'AUDIO':
    case 'VOICE':
      return 'mic-outline';
    case 'VIDEO':
      return 'videocam-outline';
    case 'FILE':
      return 'document-outline';
    default:
      return 'chatbubble-outline';
  }
}

export function PinnedHistorySheet({
  visible,
  title,
  pins,
  onClose,
  onJumpToMessage,
  onUnpin,
  unpinningId,
  deletedLabel = 'This message was deleted',
  emptyLabel = 'No pinned messages',
  unpinLabel = 'Unpin',
  colors,
  fonts,
}: Props) {
  const highlight = colors.pressHighlight || colors.primary + '12';
  const danger = colors.danger || '#EF4444';

  const sortedPins = useMemo(
    () =>
      [...pins].sort(
        (a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime()
      ),
    [pins]
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Ionicons name="pin" size={20} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={sortedPins}
            keyExtractor={(item) => item.messageId}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const deleted = !!(item.message.isDeleted || item.message.deletedForAll);
              const preview = getReplyPreviewText(item.message, deletedLabel);
              const sender = item.senderName || item.pinnedByName || 'Pinned';
              const busy = unpinningId === item.messageId;

              return (
                <View
                  style={[
                    styles.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.accent, { backgroundColor: colors.primary }]} />
                  <Pressable
                    style={({ pressed, hovered }) => [
                      styles.rowMain,
                      (pressed || (Platform.OS === 'web' && hovered)) && { backgroundColor: highlight },
                    ]}
                    onPress={() => {
                      onClose();
                      requestAnimationFrame(() => onJumpToMessage(item.messageId));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${sender}: ${preview}`}
                  >
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name={deleted ? 'trash-outline' : typeIcon(item.message.type)}
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.topLine}>
                        <Text
                          style={[styles.sender, { color: colors.primary, fontSize: fonts.xs }]}
                          numberOfLines={1}
                        >
                          {sender}
                        </Text>
                        <Ionicons name="pin" size={12} color={colors.textTertiary} />
                      </View>
                      <Text
                        style={[
                          styles.preview,
                          {
                            color: deleted ? colors.textTertiary : colors.text,
                            fontSize: fonts.sm,
                            fontStyle: deleted ? 'italic' : 'normal',
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {preview}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, marginTop: 4 }}>
                        {formatDate(item.pinnedAt)}
                      </Text>
                    </View>
                  </Pressable>

                  {onUnpin ? (
                    <TouchableOpacity
                      style={[styles.unpinBtn, { borderColor: colors.border }]}
                      hitSlop={8}
                      disabled={busy}
                      onPress={() => onUnpin(item.messageId)}
                      accessibilityRole="button"
                      accessibilityLabel={unpinLabel}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={danger} />
                      ) : (
                        <>
                          <Ionicons name="pin-outline" size={16} color={danger} />
                          <Text style={{ color: danger, fontSize: fonts.xs, fontWeight: '700' }}>
                            {unpinLabel}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={20}
                      color={colors.textTertiary}
                      style={{ marginRight: Spacing.md }}
                    />
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: Spacing.lg }}>
                {emptyLabel}
              </Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { flex: 1, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    minHeight: 72,
  },
  accent: { width: 4, alignSelf: 'stretch' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: Spacing.sm,
  },
  rowBody: { flex: 1, paddingVertical: Spacing.md, paddingRight: Spacing.sm, paddingLeft: Spacing.xs },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  sender: { fontWeight: '700', flex: 1 },
  preview: { lineHeight: 20 },
  unpinBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 56,
  },
});
