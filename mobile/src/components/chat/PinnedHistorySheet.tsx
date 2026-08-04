import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
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
  deletedLabel?: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    primary: string;
  };
  fonts: { xs: number; sm: number; md: number };
}

export function PinnedHistorySheet({
  visible,
  title,
  pins,
  onClose,
  onJumpToMessage,
  deletedLabel = 'This message was deleted',
  colors,
  fonts,
}: Props) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
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
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={pins}
            keyExtractor={(item) => item.messageId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const preview = getReplyPreviewText(item.message, deletedLabel);
              const sender = item.senderName || item.pinnedByName || 'Pinned';
              return (
                <TouchableOpacity
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    onJumpToMessage(item.messageId);
                    onClose();
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.accent, { backgroundColor: colors.primary }]} />
                  <View style={styles.rowBody}>
                    <Text style={[styles.sender, { color: colors.primary, fontSize: fonts.xs }]}>
                      {sender}
                    </Text>
                    <Text style={[styles.preview, { color: colors.text, fontSize: fonts.sm }]} numberOfLines={2}>
                      {preview}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, marginTop: 4 }}>
                      {formatDate(item.pinnedAt)}
                    </Text>
                  </View>
                  <Ionicons name="arrow-down-circle-outline" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: Spacing.lg }}>
                No pinned messages
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
    maxHeight: '72%',
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
  list: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  accent: { width: 4, alignSelf: 'stretch' },
  rowBody: { flex: 1, padding: Spacing.md },
  sender: { fontWeight: '700', marginBottom: 2 },
  preview: { lineHeight: 20 },
});
