import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  ScrollView,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AO_EMOJI_CATEGORIES,
  AO_EMOJI_CONFIG,
  getAoPremiumEmojis,
  getUnicodeByCategory,
  searchAoEmojis,
  useAoEmojiRecentStore,
  warmAoEmojiCache,
  type AoEmojiItem,
  type AoEmojiPickerPresentation,
} from '../../emoji';
import { BorderRadius, Spacing } from '../../theme';

export interface AOEmojiPickerColors {
  background: string;
  text: string;
  textSecondary: string;
  surface: string;
  surfaceSecondary?: string;
  border: string;
  inputBackground: string;
  primary: string;
  overlay?: string;
}

export interface AOEmojiPickerProps {
  visible: boolean;
  onSelect: (emoji: string, item: AoEmojiItem) => void;
  onClose: () => void;
  colors: AOEmojiPickerColors;
  fonts: { xs: number; sm: number; md: number };
  /** sheet = reaction modal; panel = composer keyboard replacement */
  presentation?: AoEmojiPickerPresentation;
  title?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  recentLabel?: string;
  premiumLockedLabel?: string;
  currentEmoji?: string;
  /** Close after select (reactions). Composer usually keeps open. */
  closeOnSelect?: boolean;
  /** MVP: premium unlocked. Wire to membership later. */
  hasPremiumAccess?: boolean;
  onPremiumLockedPress?: () => void;
}

function emojiColumns(width: number): number {
  const pad = Spacing.lg * 2;
  const usable = Math.max(280, width - pad);
  return Math.max(7, Math.min(10, Math.floor(usable / AO_EMOJI_CONFIG.EMOJI_CELL_MIN)));
}

export function AOEmojiPicker({
  visible,
  onSelect,
  onClose,
  colors,
  fonts,
  presentation = 'sheet',
  title,
  searchPlaceholder = 'Search emoji',
  emptyLabel = 'No emoji found',
  recentLabel = 'Recent',
  premiumLockedLabel = 'AO Premium',
  currentEmoji,
  closeOnSelect = presentation === 'sheet',
  hasPremiumAccess = true,
  onPremiumLockedPress,
}: AOEmojiPickerProps) {
  const { width } = useWindowDimensions();
  const cols = emojiColumns(presentation === 'panel' ? width : Math.min(width, 520));
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');

  const hydrate = useAoEmojiRecentStore((s) => s.hydrate);
  const recordUse = useAoEmojiRecentStore((s) => s.recordUse);
  const recentEntries = useAoEmojiRecentStore((s) => s.entries);

  useEffect(() => {
    if (!visible) return;
    warmAoEmojiCache();
    void hydrate();
  }, [visible, hydrate]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const searching = query.trim().length > 0;

  const searchResults = useMemo(() => (searching ? searchAoEmojis(query) : []), [query, searching]);

  const categoryItems = useMemo((): AoEmojiItem[] => {
    if (searching) return searchResults;
    if (activeCategory === 'recent') {
      return recentEntries.map((e) => ({
        id: e.id,
        char: e.char,
        name: e.char,
        keywords: [],
        categoryId: 'recent',
        type: e.type,
      }));
    }
    if (activeCategory === 'ao_premium') return getAoPremiumEmojis();
    return getUnicodeByCategory(activeCategory);
  }, [searching, searchResults, activeCategory, recentEntries]);

  const categories = useMemo(() => {
    return AO_EMOJI_CATEGORIES.filter((c) => {
      if (c.id === 'recent') return recentEntries.length > 0;
      return true;
    });
  }, [recentEntries.length]);

  useEffect(() => {
    if (activeCategory === 'recent' && recentEntries.length === 0 && !searching) {
      setActiveCategory('smileys');
    }
  }, [activeCategory, recentEntries.length, searching]);

  const handleSelect = useCallback(
    (item: AoEmojiItem) => {
      if (item.premium && item.locked && !hasPremiumAccess) {
        if (onPremiumLockedPress) {
          onPremiumLockedPress();
        } else {
          Alert.alert(premiumLockedLabel, 'AO Premium emoji will unlock with membership.');
        }
        return;
      }
      recordUse(item);
      onSelect(item.char, item);
      if (closeOnSelect) {
        onClose();
        setQuery('');
      }
    },
    [
      closeOnSelect,
      hasPremiumAccess,
      onClose,
      onPremiumLockedPress,
      onSelect,
      premiumLockedLabel,
      recordUse,
    ]
  );

  const renderItem = useCallback(
    ({ item }: { item: AoEmojiItem }) => {
      const locked = !!(item.premium && item.locked && !hasPremiumAccess);
      const selected = currentEmoji === item.char;
      return (
        <TouchableOpacity
          style={[
            styles.emojiBtn,
            {
              flexGrow: 1,
              flexBasis: `${100 / cols}%`,
              maxWidth: `${100 / cols}%`,
              backgroundColor: selected ? colors.primary + '22' : 'transparent',
              borderColor: selected ? colors.primary : 'transparent',
            },
          ]}
          onPress={() => handleSelect(item)}
          accessibilityLabel={item.name}
          accessibilityRole="button"
        >
          <Text style={styles.emoji}>{item.char}</Text>
          {item.premium ? (
            <View style={[styles.premiumDot, { backgroundColor: colors.primary }]} />
          ) : null}
          {locked ? (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={10} color={colors.textSecondary} />
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [cols, colors.primary, colors.textSecondary, currentEmoji, handleSelect, hasPremiumAccess]
  );

  const body = (
    <View
      style={[
        presentation === 'sheet' ? styles.sheet : styles.panel,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          height: presentation === 'panel' ? AO_EMOJI_CONFIG.PICKER_PANEL_HEIGHT : undefined,
          maxHeight: presentation === 'sheet' ? '72%' : undefined,
        },
      ]}
      onStartShouldSetResponder={() => true}
    >
      {presentation === 'sheet' && (
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title ? (
            <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{title}</Text>
          ) : null}
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {presentation === 'panel' && (
        <View style={styles.panelHeader}>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, fontWeight: '600' }}>
            AO Emoji
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close emoji picker">
            <Ionicons name="keypad-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.searchRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text, fontSize: fonts.sm }]}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {!searching && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
          keyboardShouldPersistTaps="handled"
        >
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? colors.primary + '18' : colors.surfaceSecondary || colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveCategory(cat.id)}
                accessibilityLabel={cat.id === 'recent' ? recentLabel : cat.label}
              >
                <Text style={styles.tabIcon}>{cat.icon}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {!searching && (
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: fonts.xs }]}>
          {activeCategory === 'recent'
            ? recentLabel
            : AO_EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.label}
        </Text>
      )}

      {searching && categoryItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>{emptyLabel}</Text>
        </View>
      ) : (
        <FlatList
          data={categoryItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={cols}
          key={`cols-${cols}`}
          style={[
            styles.grid,
            presentation === 'sheet' ? { maxHeight: 280 } : { flex: 1 },
          ]}
          contentContainerStyle={styles.gridContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={cols * 6}
          maxToRenderPerBatch={cols * 8}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}
    </View>
  );

  if (presentation === 'panel') {
    if (!visible) return null;
    return <View style={styles.panelWrap}>{body}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay || 'rgba(0,0,0,0.45)' }]}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>{body}</Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  panelWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  panel: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
    minHeight: 28,
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  title: { fontWeight: '700', alignSelf: 'flex-start' },
  closeBtn: { position: 'absolute', right: 0, top: 8 },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : 6,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, paddingVertical: 4 },
  tabs: { maxHeight: 44, marginBottom: Spacing.xs },
  tabsContent: { alignItems: 'center', paddingRight: Spacing.sm, gap: 6 },
  tab: {
    width: 40,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 4,
  },
  tabIcon: { fontSize: 18 },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  grid: { flex: 1 },
  gridContent: { paddingBottom: Spacing.md, flexGrow: 1 },
  emojiBtn: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    position: 'relative',
    minHeight: 44,
  },
  emoji: { fontSize: 26 },
  premiumDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  lockBadge: { position: 'absolute', bottom: 2, right: 4 },
  empty: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
});
