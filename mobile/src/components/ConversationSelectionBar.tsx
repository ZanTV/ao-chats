import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../../theme';

export type ConversationListAction = 'delete' | 'remove' | 'block';

interface Props {
  selectedCount: number;
  selectedLabel: string;
  deleteLabel: string;
  removeLabel: string;
  blockLabel: string;
  onBack: () => void;
  onAction: (action: ConversationListAction) => void;
  colors: {
    surface: string;
    text: string;
    textSecondary: string;
    danger: string;
    primary: string;
    border: string;
  };
  fonts: { xs: number; sm: number; md: number };
  /** Hide Block when none of the selection can be blocked (e.g. only system). */
  blockEnabled?: boolean;
}

export function ConversationSelectionBar({
  selectedCount,
  selectedLabel,
  deleteLabel,
  removeLabel,
  blockLabel,
  onBack,
  onAction,
  colors,
  fonts,
  blockEnabled = true,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10} accessibilityLabel="Cancel selection">
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>

      <Text style={[styles.count, { color: colors.text, fontSize: fonts.md }]} numberOfLines={1}>
        {selectedCount} {selectedLabel}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.action}
          onPress={() => onAction('delete')}
          accessibilityLabel={deleteLabel}
        >
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          {!compact && (
            <Text style={{ color: colors.danger, fontSize: fonts.xs, fontWeight: '600' }}>
              {deleteLabel}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={() => onAction('remove')}
          accessibilityLabel={removeLabel}
        >
          <Ionicons name="eye-off-outline" size={22} color={colors.text} />
          {!compact && (
            <Text style={{ color: colors.text, fontSize: fonts.xs, fontWeight: '600' }}>
              {removeLabel}
            </Text>
          )}
        </TouchableOpacity>

        {blockEnabled && (
          <TouchableOpacity
            style={styles.action}
            onPress={() => onAction('block')}
            accessibilityLabel={blockLabel}
          >
            <Ionicons name="ban-outline" size={22} color={colors.text} />
            {!compact && (
              <Text style={{ color: colors.text, fontSize: fonts.xs, fontWeight: '600' }}>
                {blockLabel}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  count: {
    flex: 1,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  action: {
    minWidth: 44,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
