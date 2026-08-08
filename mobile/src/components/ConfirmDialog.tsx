import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { BorderRadius, Spacing } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    danger: string;
    primary: string;
    overlay: string;
  };
  fonts: { sm: number; md: number };
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
  colors,
  fonts,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={() => {
          if (!busy) onCancel();
        }}
      >
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary, fontSize: fonts.sm }]}>
            {message}
          </Text>
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.btn}
              onPress={onCancel}
              activeOpacity={0.7}
              disabled={busy}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: fonts.sm,
                  fontWeight: '600',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn, { borderLeftColor: colors.border }]}
              onPress={onConfirm}
              activeOpacity={0.7}
              disabled={busy}
            >
              <Text
                style={{
                  color: destructive ? colors.danger : colors.primary,
                  fontSize: fonts.sm,
                  fontWeight: '700',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? '…' : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  title: {
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  message: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
  },
  confirmBtn: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
});
