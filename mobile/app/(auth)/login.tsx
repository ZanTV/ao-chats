import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { ApiError } from '../../src/utils/validation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { Spacing, BorderRadius } from '../../src/theme';

export default function LoginScreen() {
  const { login } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const handleLogin = async () => {
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    setFormError('');
    try {
      await login(email.trim().toLowerCase(), password, rememberMe);
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        if (Platform.OS === 'web') {
          setFormError(t.auth.verifyLoginPrompt);
        } else {
          Alert.alert(
            t.auth.verifyEmail,
            t.auth.verifyLoginPrompt,
            [
              { text: t.common.cancel, style: 'cancel' },
              {
                text: t.auth.verifyNow,
                onPress: () =>
                  router.push({
                    pathname: '/(auth)/verify-email',
                    params: {
                      email: email.trim().toLowerCase(),
                      sendCode: 'true',
                    },
                  }),
              },
            ]
          );
        }
      } else {
        const message = err instanceof Error ? err.message : t.common.error;
        setFormError(message);
        if (Platform.OS !== 'web') {
          Alert.alert('Error', message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.logoText, { color: colors.primary }]}>AO</Text>
            </View>
            <Text style={[styles.title, { color: colors.text, fontSize: fonts.title }]}>
              {t.app.name}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fonts.md }]}>
              {t.app.tagline}
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t.auth.email}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
              error={errors.email}
            />
            <Input
              label={t.auth.password}
              value={password}
              onChangeText={setPassword}
              isPassword
              icon="lock-closed-outline"
              error={errors.password}
            />

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <Ionicons
                  name={rememberMe ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={colors.primary}
                />
                <Text style={[styles.rememberText, { color: colors.textSecondary }]}>
                  {t.auth.rememberMe}
                </Text>
              </TouchableOpacity>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={[styles.forgotText, { color: colors.primary }]}>
                    {t.auth.forgotPassword}
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>

            <Button title={t.auth.login} onPress={handleLogin} loading={loading} fullWidth />

            {formError ? (
              <View style={[styles.errorBox, { backgroundColor: colors.danger + '15' }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
                {formError === t.auth.verifyLoginPrompt ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/(auth)/verify-email',
                        params: {
                          email: email.trim().toLowerCase(),
                          sendCode: 'true',
                        },
                      })
                    }
                  >
                    <Text style={[styles.verifyLink, { color: colors.primary }]}>
                      {t.auth.verifyNow}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              {t.auth.noAccount}{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  {t.auth.register}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: { fontSize: 32, fontWeight: '800' },
  title: { fontWeight: '700', marginBottom: Spacing.xs },
  subtitle: { textAlign: 'center' },
  form: { marginBottom: Spacing.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rememberText: { fontSize: 14 },
  forgotText: { fontSize: 14, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14 },
  linkText: { fontSize: 14, fontWeight: '600' },
  errorBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorText: { fontSize: 14, textAlign: 'center' },
  verifyLink: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: Spacing.sm },
});
