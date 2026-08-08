import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../theme';

export interface ActionMenuItem {
  key: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  items: ActionMenuItem[];
  onClose: () => void;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    danger: string;
    pressHighlight?: string;
  };
  fonts: { sm: number; md: number };
  cancelLabel?: string;
}

export function ActionMenuSheet({
  visible,
  title,
  items,
  onClose,
  colors,
  fonts,
  cancelLabel = 'Cancel',
}: Props) {
  const highlight = colors.pressHighlight || colors.border;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{title}</Text>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, { borderTopColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                requestAnimationFrame(() => item.onPress());
              }}
            >
              <Text
                style={{
                  color: item.destructive ? colors.danger : colors.text,
                  fontSize: fonts.sm,
                  fontWeight: item.destructive ? '600' : '500',
                  textAlign: 'center',
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: highlight }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: fonts.sm, fontWeight: '600' }}>
              {cancelLabel}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  item: {
    paddingVertical: Spacing.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
});
