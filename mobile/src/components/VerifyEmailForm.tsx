import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { Spacing, BorderRadius } from '../theme';

interface VerifyEmailFormProps {
  email: string;
  onSuccess: () => void;
  autoSendCode?: boolean;
}

export function VerifyEmailForm({ email, onSuccess, autoSendCode }: VerifyEmailFormProps) {
  const { verifyEmail } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  const startCodeTimer = (minutes = 5) => {
    setCodeExpiresAt(Date.now() + minutes * 60 * 1000);
  };

  const formatCountdown = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (autoSendCode && normalizedEmail) {
      api.resendVerification(normalizedEmail)
        .then(() => {
          startCodeTimer(5);
          setResendCooldown(60);
        })
        .catch((err) => {
          Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
        });
    }
  }, [autoSendCode, normalizedEmail]);

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

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.resendVerification(normalizedEmail);
      startCodeTimer(5);
      setVerifyCode('');
      setResendCooldown(60);
      Alert.alert('Email Sent', `New code sent to ${normalizedEmail}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Enter 6-digit code');
      return;
    }
    if (secondsLeft === 0 && codeExpiresAt) {
      Alert.alert('Code Expired', t.auth.codeExpired);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await verifyEmail(normalizedEmail, verifyCode.trim());
      onSuccess();
    } catch (err) {
      Alert.alert('Verification Failed', err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fonts.md }]}>
        {t.auth.verifySubtitle}
      </Text>

      <View style={[styles.emailBadge, { backgroundColor: colors.primary + '12' }]}>
        <Ionicons name="mail-outline" size={18} color={colors.primary} />
        <Text style={[styles.emailText, { color: colors.primary, fontSize: fonts.sm }]}>
          {t.auth.codeSentTo} {normalizedEmail}
        </Text>
      </View>

      {codeExpiresAt && (
        <Text style={[
          styles.timer,
          { color: secondsLeft > 0 ? colors.textSecondary : colors.danger, fontSize: fonts.sm },
        ]}>
          {secondsLeft > 0
            ? `${t.auth.codeExpiresIn} ${formatCountdown(secondsLeft)}`
            : t.auth.codeExpired}
        </Text>
      )}

      <Input
        label="Verification Code"
        value={verifyCode}
        onChangeText={(v) => {
          setVerifyCode(v.replace(/\D/g, '').slice(0, 6));
          setError('');
        }}
        keyboardType="number-pad"
        maxLength={6}
        icon="key-outline"
        error={error}
      />

      <TouchableOpacity onPress={handleResend} style={styles.resend} disabled={resendCooldown > 0}>
        <Text style={{ color: resendCooldown > 0 ? colors.textTertiary : colors.primary, fontWeight: '500' }}>
          {resendCooldown > 0 ? `${t.auth.resendIn} ${resendCooldown}s` : t.auth.resendCode}
        </Text>
      </TouchableOpacity>

      <Button title={t.auth.verifyEmail} onPress={handleVerify} loading={loading} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: Spacing.lg, lineHeight: 22 },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  emailText: { fontWeight: '500', flex: 1 },
  timer: { marginBottom: Spacing.md, fontWeight: '600' },
  resend: { alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.md },
});
