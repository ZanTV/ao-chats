import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../stores/settingsStore';
import { filterUniversities, getUniversityAbbreviations, getUniversityLocation } from '../constants/signup';
import { BorderRadius, Spacing } from '../theme';

interface UniversityPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  universities: string[];
  error?: string;
  placeholder?: string;
}

export function UniversityPicker({
  label,
  value,
  onChange,
  universities,
  error,
  placeholder = 'Select your university',
}: UniversityPickerProps) {
  const { colors, fonts, t } = useSettingsStore();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => filterUniversities(search, universities),
    [search, universities]
  );

  const openModal = () => {
    setSearch('');
    setVisible(true);
  };

  const selectUniversity = (name: string) => {
    onChange(name);
    setVisible(false);
    setSearch('');
  };

  const closeModal = () => {
    setVisible(false);
    setSearch('');
  };

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary, fontSize: fonts.sm }]}>
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openModal}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <Ionicons name="school-outline" size={20} color={colors.textTertiary} style={styles.triggerIcon} />
        <Text
          style={[
            styles.triggerText,
            {
              color: value ? colors.text : colors.textTertiary,
              fontSize: fonts.md,
            },
          ]}
          numberOfLines={2}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      {error ? (
        <Text style={[styles.error, { color: colors.danger, fontSize: fonts.xs }]}>{error}</Text>
      ) : null}

      <Modal visible={visible} animationType="slide" transparent onRequestClose={closeModal}>
        <Pressable style={styles.overlay} onPress={closeModal}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fonts.lg }]}>
                {label || t.auth.university}
              </Text>
              <TouchableOpacity onPress={closeModal} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, abbreviation, or location (e.g. UDSM, Dodoma)"
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { color: colors.text, fontSize: fonts.md }]}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={Platform.OS === 'web'}
              />
              {search.length > 0 ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.sm }]}>
                  No universities match &quot;{search}&quot;
                </Text>
              }
              renderItem={({ item }) => {
                const abbrevs = getUniversityAbbreviations(item);
                const location = getUniversityLocation(item);
                const selected = value === item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      {
                        backgroundColor: selected ? colors.primary + '12' : colors.surfaceSecondary,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => selectUniversity(item)}
                  >
                    <View style={styles.optionBody}>
                      <Text
                        style={{
                          color: selected ? colors.primary : colors.text,
                          fontSize: fonts.md,
                          fontWeight: selected ? '600' : '500',
                        }}
                      >
                        {item}
                      </Text>
                      {item !== 'Other' && abbrevs.length > 0 ? (
                        <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, marginTop: 2 }}>
                          {abbrevs.join(' · ')}
                          {location ? ` · ${location}` : ''}
                        </Text>
                      ) : location && item === 'Other' ? (
                        <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, marginTop: 2 }}>
                          {location}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: { marginBottom: Spacing.xs, fontWeight: '500' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  triggerIcon: { marginRight: Spacing.sm },
  triggerText: { flex: 1, paddingVertical: Spacing.sm },
  error: { marginTop: Spacing.xs },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sheetTitle: { fontWeight: '700', flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: Platform.OS === 'web' ? 10 : Spacing.sm },
  list: { paddingHorizontal: Spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  optionBody: { flex: 1, paddingRight: Spacing.sm },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.xl },
});
