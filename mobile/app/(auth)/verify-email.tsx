import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VerifyEmailForm } from '../../src/components/VerifyEmailForm';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { Spacing } from '../../src/theme';

export default function VerifyEmailScreen() {
  const { email, sendCode } = useLocalSearchParams<{ email: string; sendCode?: string }>();
  const { colors, fonts, t } = useSettingsStore();

  if (!email) {
    router.replace('/(auth)/login');
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.title }]}>
            {t.auth.verifyEmail}
          </Text>

          <VerifyEmailForm
            email={email}
            autoSendCode={sendCode === 'true'}
            onSuccess={() => router.replace('/(tabs)')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  back: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  scroll: { padding: Spacing.lg, flexGrow: 1 },
  title: { fontWeight: '700', marginBottom: Spacing.md },
});
