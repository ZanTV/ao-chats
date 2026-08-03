import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';

export function LoadingScreen() {
  const colors = useSettingsStore((s) => s.colors);
  const t = useSettingsStore((s) => s.t);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.logo, { color: colors.primary }]}>AO Chats</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{t.common.loading}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 32, fontWeight: '700', marginBottom: 24 },
  spinner: { marginBottom: 16 },
  text: { fontSize: 14 },
});
