import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { ApiError } from '../../src/utils/validation';
import { Spacing, BorderRadius } from '../../src/theme';

const RESEND_COOLDOWN_SEC = 30;
const CODE_EXPIRY_MIN = 10;

export default function ForgotPasswordScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  const normalizedEmail = email.trim().toLowerCase();

  const startCodeTimer = () => {
    setCodeExpiresAt(Date.now() + CODE_EXPIRY_MIN * 60 * 1000);
  };

  const formatCountdown = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!codeExpiresAt) return;
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.floor((codeExpiresAt - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const mapResetError = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.code === 'RESET_COOLDOWN') return t.auth.resetCooldown + ` ${resendCooldown || RESEND_COOLDOWN_SEC}s`;
      if (err.code === 'RESET_EXPIRED') return t.auth.resetExpired;
      if (err.code === 'INVALID_RESET_CODE') return t.auth.invalidResetCode;
      if (err.code === 'RESET_ATTEMPTS') return t.auth.resetAttempts;
      if (err.code === 'EMAIL_SEND_FAILED') return t.auth.emailSendFailed;
      return err.message;
    }
    return err instanceof Error ? err.message : t.common.error;
  };

  const handleSendCode = async () => {
    if (!normalizedEmail) {
      Alert.alert(t.common.error, t.auth.invalidEmail);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert(t.common.error, t.auth.invalidEmail);
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(normalizedEmail);
      startCodeTimer();
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setStep('reset');
      Alert.alert(t.auth.resetSuccess, t.auth.resetCodeSent);
    } catch (err) {
      Alert.alert(t.common.error, mapResetError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await api.forgotPassword(normalizedEmail);
      startCodeTimer();
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SEC);
      Alert.alert(t.auth.resetSuccess, t.auth.resetCodeSent);
    } catch (err) {
      Alert.alert(t.common.error, mapResetError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code || code.length !== 6) {
      Alert.alert(t.common.error, t.auth.verifySubtitle);
      return;
    }
    if (secondsLeft === 0 && codeExpiresAt) {
      Alert.alert(t.common.error, t.auth.resetExpired);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t.common.error, t.auth.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(normalizedEmail, code.trim(), newPassword, confirmPassword);
      setStep('done');
    } catch (err) {
      Alert.alert(t.common.error, mapResetError(err));
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.xl }]}>
            {t.auth.resetPasswordTitle}
          </Text>

          {step === 'email' && (
            <>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fonts.md }]}>
                {t.auth.resetPasswordSubtitle}
              </Text>
              <Input
                label={t.auth.email}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
              />
              <Button title={t.auth.sendResetCode} onPress={handleSendCode} loading={loading} fullWidth />
            </>
          )}

          {step === 'reset' && (
            <>
              <View style={[styles.emailBadge, { backgroundColor: colors.primary + '12' }]}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
                <Text style={[styles.emailText, { color: colors.primary, fontSize: fonts.sm }]}>
                  {t.auth.codeSentTo} {normalizedEmail}
                </Text>
              </View>

              {codeExpiresAt && (
                <Text
                  style={[
                    styles.timer,
                    { color: secondsLeft > 0 ? colors.textSecondary : colors.danger, fontSize: fonts.sm },
                  ]}
                >
                  {secondsLeft > 0
                    ? `${t.auth.codeExpiresIn} ${formatCountdown(secondsLeft)}`
                    : t.auth.resetExpired}
                </Text>
              )}

              <Input
                label={t.auth.resetCode}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                icon="key-outline"
              />
              <Input
                label={t.auth.newPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
                icon="lock-closed-outline"
              />
              <Input
                label={t.auth.confirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                icon="lock-closed-outline"
              />

              <Button title={t.auth.resetPasswordTitle} onPress={handleReset} loading={loading} fullWidth />

              <TouchableOpacity
                onPress={handleResend}
                disabled={resendCooldown > 0 || loading}
                style={styles.resendBtn}
              >
                <Text
                  style={{
                    color: resendCooldown > 0 ? colors.textTertiary : colors.primary,
                    fontSize: fonts.sm,
                    fontWeight: '600',
                  }}
                >
                  {resendCooldown > 0
                    ? `${t.auth.resetCooldown} ${resendCooldown}s`
                    : t.auth.resendCode}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <View style={styles.doneWrap}>
              <Ionicons name="checkmark-circle" size={72} color={colors.success} />
              <Text style={[styles.doneTitle, { color: colors.text, fontSize: fonts.lg }]}>
                {t.auth.resetSuccess}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fonts.md }]}>
                {t.auth.resetSuccessMessage}
              </Text>
              <Button title={t.auth.backToLogin} onPress={() => router.replace('/(auth)/login')} fullWidth />
            </View>
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
  title: { fontWeight: '700', marginBottom: Spacing.sm },
  subtitle: { marginBottom: Spacing.lg, lineHeight: 22 },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  emailText: { flex: 1, fontWeight: '500' },
  timer: { marginBottom: Spacing.md, fontWeight: '500' },
  resendBtn: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
  doneWrap: { alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.md },
  doneTitle: { fontWeight: '700', textAlign: 'center' },
});
