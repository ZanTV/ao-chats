import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { BorderRadius, Spacing } from '../../theme';

const FREQUENT = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✨'];

interface Props {
  visible: boolean;
  title: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  colors: { background: string; text: string; surface: string; border: string };
  fonts: { md: number };
}

export function ReactionPicker({ visible, title, onSelect, onClose, colors, fonts }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{title}</Text>
          <View style={styles.grid}>
            {FREQUENT.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiBtn, { backgroundColor: colors.surface }]}
                onPress={() => {
                  onSelect(emoji);
                  onClose();
                }}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1 },
  title: { fontWeight: '700', marginBottom: Spacing.md, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
  emojiBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
});
