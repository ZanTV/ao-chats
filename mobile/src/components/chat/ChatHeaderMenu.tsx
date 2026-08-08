import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../../theme';

export interface HeaderMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  items: HeaderMenuItem[];
  onClose: () => void;
  topOffset?: number;
  colors: {
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    danger: string;
    overlay: string;
    shadow: string;
  };
  fonts: { sm: number; md: number };
}

export function ChatHeaderMenu({
  visible,
  title,
  items,
  onClose,
  topOffset = Platform.OS === 'web' ? 64 : 56,
  colors,
  fonts,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.menu,
            {
              top: topOffset,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {title ? (
            <Text style={[styles.title, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {title}
            </Text>
          ) : null}
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.item,
                index > 0 || title ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null,
              ]}
              activeOpacity={0.65}
              onPress={() => {
                onClose();
                requestAnimationFrame(() => item.onPress());
              }}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.destructive ? colors.danger : colors.text}
              />
              <Text
                style={{
                  color: item.destructive ? colors.danger : colors.text,
                  fontSize: fonts.sm,
                  fontWeight: '500',
                  flex: 1,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    right: Spacing.md,
    minWidth: 220,
    maxWidth: 280,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xs,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
});
