import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../../theme';
import type { DetectedEntity, DetectedEntityType } from '../../links/detect';
import { router } from 'expo-router';

export type ContactActionKey = 'open' | 'call' | 'copy' | 'cancel';

type Labels = {
  open: string;
  openEmail: string;
  openLocation: string;
  call: string;
  copy: string;
  cancel: string;
  copiedLink: string;
  copiedEmail: string;
  copiedPhone: string;
  copiedLocation: string;
};

interface Props {
  visible: boolean;
  entity: DetectedEntity | null;
  onClose: () => void;
  labels: Labels;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    pressHighlight?: string;
  };
  fonts: { sm: number; md: number };
  onCopied?: (message: string) => void;
}

function openLabelFor(type: DetectedEntityType, labels: Labels): string {
  if (type === 'email') return labels.openEmail;
  if (type === 'location') return labels.openLocation;
  if (type === 'phone') return labels.call;
  return labels.open;
}

function copiedLabelFor(type: DetectedEntityType, labels: Labels): string {
  if (type === 'email') return labels.copiedEmail;
  if (type === 'phone') return labels.copiedPhone;
  if (type === 'location') return labels.copiedLocation;
  return labels.copiedLink;
}

async function performOpen(entity: DetectedEntity) {
  if (entity.type === 'phone') {
    await Linking.openURL(`tel:${entity.value}`);
    return;
  }
  if (entity.type === 'email') {
    await Linking.openURL(`mailto:${entity.value}`);
    return;
  }
  if (entity.type === 'ao_chats') {
    try {
      const parsed = new URL(entity.value);
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
      if (path.startsWith('/chat/') || path.startsWith('/u/') || path === '/' || path.startsWith('/(tabs)')) {
        router.push(path as any);
        return;
      }
    } catch {
      // fall through
    }
  }
  await Linking.openURL(entity.value);
}

export function DetectedContactActionSheet({
  visible,
  entity,
  onClose,
  labels,
  colors,
  fonts,
  onCopied,
}: Props) {
  const highlight = colors.pressHighlight || colors.border;

  const actions = useMemo(() => {
    if (!entity) return [] as Array<{ key: ContactActionKey; label: string; run: () => void }>;
    const openKey: ContactActionKey = entity.type === 'phone' ? 'call' : 'open';
    return [
      {
        key: openKey,
        label: openLabelFor(entity.type, labels),
        run: () => {
          performOpen(entity).catch(() => {
            Alert.alert(labels.open, entity.value);
          });
        },
      },
      {
        key: 'copy' as const,
        label: labels.copy,
        run: async () => {
          await Clipboard.setStringAsync(entity.value);
          onCopied?.(copiedLabelFor(entity.type, labels));
        },
      },
    ];
  }, [entity, labels, onCopied]);

  if (!entity) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text
            style={[styles.title, { color: colors.text, fontSize: fonts.md }]}
            numberOfLines={3}
            selectable={Platform.OS === 'web'}
          >
            {entity.display}
          </Text>
          {actions.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, { borderTopColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                requestAnimationFrame(() => item.run());
              }}
            >
              <Text style={{ color: colors.primary, fontSize: fonts.sm, fontWeight: '600', textAlign: 'center' }}>
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
              {labels.cancel}
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
    fontWeight: '600',
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
