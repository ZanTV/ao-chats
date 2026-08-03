import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../utils/messages';
import { AoMessageStatus } from './AoMessageStatus';
import { getAoMessageStatus } from '../../utils/messageStatus';
import { BorderRadius, Spacing } from '../../theme';

interface Props {
  visible: boolean;
  message: ChatMessage | null;
  senderName: string;
  isOwn: boolean;
  onClose: () => void;
  labels: {
    title: string;
    sent: string;
    delivered: string;
    read: string;
    sender: string;
    messageId: string;
    close: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
  };
  fonts: { sm: number; md: number; xs: number };
}

function formatFull(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function MessageInfoSheet({ visible, message, senderName, isOwn, onClose, labels, colors, fonts }: Props) {
  if (!message) return null;
  const status = getAoMessageStatus(message, isOwn);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{labels.title}</Text>
          <ScrollView>
            <InfoRow label={labels.sender} value={senderName} colors={colors} fonts={fonts} />
            <InfoRow label={labels.sent} value={formatFull(message.createdAt)} colors={colors} fonts={fonts} />
            <InfoRow label={labels.delivered} value={formatFull(message.deliveredAt)} colors={colors} fonts={fonts} />
            <InfoRow label={labels.read} value={formatFull(message.readAt)} colors={colors} fonts={fonts} />
            {status && (
              <View style={styles.statusRow}>
                <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>Status</Text>
                <AoMessageStatus status={status} color={colors.primary} readColor={colors.primary} size={16} />
              </View>
            )}
            <InfoRow label={labels.messageId} value={message.id} colors={colors} fonts={fonts} mono />
          </ScrollView>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={{ color: '#FFF', fontWeight: '600' }}>{labels.close}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
  colors,
  fonts,
  mono,
}: {
  label: string;
  value: string;
  colors: Props['colors'];
  fonts: Props['fonts'];
  mono?: boolean;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>{label}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: fonts.sm,
          fontWeight: '500',
          fontFamily: mono ? 'monospace' : undefined,
        }}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '70%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  title: { fontWeight: '700', marginBottom: Spacing.md },
  row: { paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  closeBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
});
