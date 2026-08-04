import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';

interface Props {
  onLayout?: () => void;
}

export function LoadingScreen({ onLayout }: Props) {
  const colors = useSettingsStore((s) => s.colors);
  const t = useSettingsStore((s) => s.t);
  const { initializeAuth, isLoading } = useAuthStore();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowRetry(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = async () => {
    setShowRetry(false);
    await initializeAuth();
    setTimeout(() => setShowRetry(true), 8000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} onLayout={onLayout}>
      <Text style={[styles.logo, { color: colors.primary }]}>AO Chats</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {isLoading ? t.common.loading : t.common.loading}
      </Text>
      {showRetry && isLoading && (
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={handleRetry}
        >
          <Text style={styles.retryText}>{t.common.retry}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 32, fontWeight: '700', marginBottom: 24 },
  spinner: { marginBottom: 16 },
  text: { fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});
