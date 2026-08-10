import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Avatar } from '../Avatar';
import { api } from '../../services/api';
import { BorderRadius, Spacing } from '../../theme';

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  avatarId: string;
  avatarUrl?: string | null;
  avatarVersion?: number;
  username: string;
}

interface Props {
  visible: boolean;
  messageId: string;
  title: string;
  onClose: () => void;
  onForwarded: () => void;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
    surface: string;
  };
  fonts: { md: number; sm: number };
}

export function ForwardSheet({ visible, messageId, title, onClose, onForwarded, colors, fonts }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSelected(new Set());
    api.getFriends()
      .then((res) => setFriends((res as { friends: Friend[] }).friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleForward = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      for (const userId of selected) {
        const conv = await api.getOrCreateConversation(userId) as { id: string };
        await api.forwardMessage(messageId, conv.id);
      }
      onForwarded();
      onClose();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{title}</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.xl }} />
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.row, { backgroundColor: isSelected ? colors.primary + '12' : colors.surface }]}
                    onPress={() => toggle(item.id)}
                  >
                    <Avatar
                      userId={item.id}
                      avatarId={item.avatarId}
                      imageUrl={item.avatarUrl}
                      imageVersion={item.avatarVersion}
                      size={40}
                    />
                    <View style={styles.rowText}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: fonts.sm }}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>@{item.username}</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.check, { backgroundColor: colors.primary }]}>
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: selected.size ? colors.primary : colors.border }]}
              onPress={handleForward}
              disabled={!selected.size || sending}
            >
              <Text style={{ color: '#FFF', fontWeight: '600' }}>
                {sending ? '...' : `Forward (${selected.size})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '75%',
  },
  title: { fontWeight: '700', marginBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  rowText: { flex: 1 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: { flex: 1, padding: Spacing.md, alignItems: 'center' },
  sendBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' },
});
