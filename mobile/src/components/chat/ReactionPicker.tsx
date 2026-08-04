import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EMOJI_CATEGORIES, searchEmojis } from '../../data/emojis';
import { BorderRadius, Spacing } from '../../theme';

interface Props {
  visible: boolean;
  title: string;
  currentEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    surface: string;
    border: string;
    inputBackground: string;
    primary: string;
  };
  fonts: { xs: number; sm: number; md: number };
  searchPlaceholder?: string;
}

export function ReactionPicker({
  visible,
  title,
  currentEmoji,
  onSelect,
  onClose,
  colors,
  fonts,
  searchPlaceholder = 'Search emoji',
}: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('frequent');

  const searchResults = useMemo(() => searchEmojis(query), [query]);
  const activeEmojis = useMemo(() => {
    if (query.trim()) return searchResults.map((r) => r.emoji);
    return EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis ?? [];
  }, [query, searchResults, activeCategory]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
    setQuery('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: colors.inputBackground }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, fontSize: fonts.sm }]}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {!query.trim() && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
              {EMOJI_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.tab,
                    activeCategory === cat.id && { backgroundColor: colors.primary + '18' },
                  ]}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Text
                    style={{
                      color: activeCategory === cat.id ? colors.primary : colors.textSecondary,
                      fontSize: fonts.xs,
                      fontWeight: '600',
                    }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <ScrollView style={styles.emojiScroll} contentContainerStyle={styles.grid}>
            {activeEmojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiBtn,
                  { backgroundColor: colors.surface },
                  currentEmoji === emoji && { borderColor: colors.primary, borderWidth: 2 },
                ]}
                onPress={() => handleSelect(emoji)}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '70%',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  title: { flex: 1, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: 4 },
  tabs: { marginBottom: Spacing.sm, maxHeight: 36 },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  emojiScroll: { maxHeight: 280 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
});
