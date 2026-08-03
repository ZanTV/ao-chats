import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { Spacing } from '../../src/theme';

export default function ForgotPasswordScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await api.forgotPassword(email);
      Alert.alert('Success', 'If the email exists, a reset code has been sent');
      setStep('reset');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code || !newPassword) return;
    setLoading(true);
    try {
      await api.resetPassword(email, code, newPassword);
      Alert.alert('Success', 'Password reset successful', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.xl }]}>
            {t.auth.forgotPassword}
          </Text>
          {step === 'email' ? (
            <>
              <Input label={t.auth.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
              <Button title="Send Reset Code" onPress={handleSendCode} loading={loading} fullWidth />
            </>
          ) : (
            <>
              <Input label="Reset Code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} icon="key-outline" />
              <Input label="New Password" value={newPassword} onChangeText={setNewPassword} isPassword icon="lock-closed-outline" />
              <Button title="Reset Password" onPress={handleReset} loading={loading} fullWidth />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  back: { padding: Spacing.lg },
  scroll: { padding: Spacing.lg, flexGrow: 1 },
  title: { fontWeight: '700', marginBottom: Spacing.xl },
});
