import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/stores/settingsStore';
import {
  UNIVERSITY_OPTIONS,
  UniversityOption,
  filterUniversities,
  getUniversityOption,
} from '../../src/constants/signup';
import { BorderRadius, Spacing } from '../../src/theme';

export default function UniversitiesScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UniversityOption | null>(null);

  const names = useMemo(() => UNIVERSITY_OPTIONS.map((u) => u.name), []);
  const filtered = useMemo(() => filterUniversities(search, names), [search, names]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.lg }]}>
          {t.settings.universitiesDirectory}
        </Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t.settings.searchUniversities}
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text, fontSize: fonts.md }]}
          autoCapitalize="none"
          autoCorrect={false}
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
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSecondary, fontSize: fonts.sm }]}>
            {t.settings.noUniversitiesMatch}
          </Text>
        }
        renderItem={({ item }) => {
          const opt = getUniversityOption(item);
          if (!opt) return null;
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setSelected(opt)}
              activeOpacity={0.75}
            >
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: fonts.md }]}>{opt.name}</Text>
                {opt.name !== 'Other' ? (
                  <Text style={{ color: colors.textSecondary, fontSize: fonts.sm, marginTop: 4 }}>
                    {opt.abbreviation} · {opt.location}
                  </Text>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontSize: fonts.sm, marginTop: 4 }}>
                    {opt.location}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable
            style={[styles.detailSheet, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selected ? (
              <>
                <View style={styles.detailHeader}>
                  <Text style={[styles.detailTitle, { color: colors.text, fontSize: fonts.lg }]}>
                    {selected.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {selected.name !== 'Other' ? (
                  <>
                    <DetailRow
                      label={t.settings.universityAbbreviation}
                      value={selected.abbreviation}
                      colors={colors}
                      fonts={fonts}
                    />
                    <DetailRow
                      label={t.settings.universityLocation}
                      value={selected.location}
                      colors={colors}
                      fonts={fonts}
                    />
                  </>
                ) : (
                  <DetailRow
                    label={t.settings.universityLocation}
                    value={selected.location}
                    colors={colors}
                    fonts={fonts}
                  />
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  colors,
  fonts,
}: {
  label: string;
  value: string;
  colors: { textSecondary: string; text: string; surfaceSecondary: string; border: string };
  fonts: { sm: number; md: number };
}) {
  return (
    <View style={[styles.detailRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: fonts.md, fontWeight: '600', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontWeight: '700', flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: Platform.OS === 'web' ? 10 : Spacing.sm },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  cardBody: { flex: 1, paddingRight: Spacing.sm },
  cardTitle: { fontWeight: '600' },
  empty: { textAlign: 'center', paddingVertical: Spacing.xxl },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailTitle: { fontWeight: '700', flex: 1 },
  detailRow: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
});
