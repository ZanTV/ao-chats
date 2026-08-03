import React, { useState, useEffect } from 'react';
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
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Avatar } from '../../src/components/Avatar';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { loadAvatarCategories, loadUniversities } from '../../src/services/signupOptions';
import { getLocalPasswordStrength } from '../../src/constants/signup';
import { validatePassword, validateUsername } from '../../src/utils/validation';
import { Spacing, BorderRadius } from '../../src/theme';

const TOTAL_STEPS = 5;

const AVATAR_CATEGORIES = [
  { key: 'animals', label: 'Animals', icon: '🐾' },
  { key: 'nature', label: 'Nature', icon: '🌿' },
  { key: 'technology', label: 'Technology', icon: '💻' },
  { key: 'sports', label: 'Sports', icon: '⚽' },
  { key: 'education', label: 'Education', icon: '📚' },
  { key: 'minimal', label: 'Minimal', icon: '⭐' },
];

export default function RegisterScreen() {
  const { register, verifyEmail } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [university, setUniversity] = useState('');
  const [course, setCourse] = useState('');
  const [avatarId, setAvatarId] = useState('avatar-1');
  const [verifyCode, setVerifyCode] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: 'weak' });
  const [universities, setUniversities] = useState<string[]>([]);
  const [avatarCategories, setAvatarCategories] = useState<Record<string, string[]>>({});
  const [selectedCategory, setSelectedCategory] = useState('animals');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    Promise.all([loadUniversities(), loadAvatarCategories()])
      .then(([uniList, avatarMap]) => {
        if (!active) return;
        setUniversities(uniList);
        setAvatarCategories(avatarMap);
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (password.length >= 4) {
      api.checkPasswordStrength(password)
        .then(setPasswordStrength)
        .catch(() => setPasswordStrength(getLocalPasswordStrength(password)));
    }
  }, [password]);

  useEffect(() => {
    if (!codeExpiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((codeExpiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
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

  const startCodeTimer = (minutes = 5) => {
    setCodeExpiresAt(Date.now() + minutes * 60 * 1000);
  };

  const formatCountdown = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const strengthColors: Record<string, string> = {
    weak: colors.danger,
    fair: colors.warning,
    good: colors.primary,
    strong: colors.success,
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!firstName.trim()) newErrors.firstName = 'First name is required';
      else if (firstName.trim().length < 2) newErrors.firstName = 'At least 2 characters';
      if (!lastName.trim()) newErrors.lastName = 'Last name is required';
      else if (lastName.trim().length < 2) newErrors.lastName = 'At least 2 characters';
      const usernameError = validateUsername(username);
      if (usernameError) newErrors.username = usernameError;
    } else if (step === 2) {
      if (!email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newErrors.email = 'Invalid email address';
      }
      const passwordError = validatePassword(password);
      if (passwordError) newErrors.password = passwordError;
      if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    } else if (step === 3) {
      if (!university) newErrors.university = 'Please select a university';
    } else if (step === 5) {
      if (!verifyCode || verifyCode.length !== 6) newErrors.verifyCode = 'Enter 6-digit code';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    setFormError('');

    if (step === 4) {
      setLoading(true);
      try {
        await register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password,
          university,
          course: course.trim() || undefined,
          avatarId,
        });
        startCodeTimer(5);
        setStep(5);
      } catch (err) {
        const message = err instanceof Error ? err.message : t.common.error;
        setFormError(message);
        if (Platform.OS !== 'web') {
          Alert.alert('Registration Error', message);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 5) {
      if (secondsLeft === 0 && codeExpiresAt) {
        const message = t.auth.codeExpired;
        setFormError(message);
        if (Platform.OS !== 'web') Alert.alert('Code Expired', message);
        return;
      }
      setLoading(true);
      try {
        await verifyEmail(email.trim().toLowerCase(), verifyCode.trim());
        router.replace('/(tabs)');
      } catch (err) {
        const message = err instanceof Error ? err.message : t.common.error;
        setFormError(message);
        if (Platform.OS !== 'web') {
          Alert.alert('Verification Failed', message);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    setStep(step + 1);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.resendVerification(email.trim().toLowerCase());
      startCodeTimer(5);
      setVerifyCode('');
      setResendCooldown(60);
      Alert.alert('Email Sent', `New code sent to ${email.trim().toLowerCase()}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fonts.xl }]}>
              {t.auth.welcome}
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              {t.auth.welcomeSubtitle}
            </Text>
            <Input label={t.auth.firstName} value={firstName} onChangeText={setFirstName} icon="person-outline" error={errors.firstName} />
            <Input label={t.auth.lastName} value={lastName} onChangeText={setLastName} icon="person-outline" error={errors.lastName} />
            <Input label={t.auth.username} value={username} onChangeText={setUsername} autoCapitalize="none" icon="at-outline" error={errors.username} />
          </>
        );
      case 2:
        return (
          <>
            <Input label={t.auth.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" error={errors.email} />
            <Input label={t.auth.password} value={password} onChangeText={setPassword} isPassword icon="lock-closed-outline" error={errors.password} />
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={[styles.strengthTrack, { backgroundColor: colors.borderLight }]}>
                  <View style={[styles.strengthFill, { width: `${(passwordStrength.score / 5) * 100}%`, backgroundColor: strengthColors[passwordStrength.label] }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColors[passwordStrength.label] }]}>
                  {passwordStrength.label.charAt(0).toUpperCase() + passwordStrength.label.slice(1)}
                </Text>
              </View>
            )}
            <Input label={t.auth.confirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} isPassword icon="lock-closed-outline" error={errors.confirmPassword} />
            <Text style={[styles.hint, { color: colors.textTertiary, fontSize: fonts.xs }]}>
              Password must have 8+ characters, uppercase, lowercase, and a number
            </Text>
          </>
        );
      case 3:
        return (
          <>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fonts.lg }]}>
              {t.auth.university}
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Select your university to connect with your campus community
            </Text>
            {optionsLoading ? (
              <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md }}>
                {t.common.loading}
              </Text>
            ) : (
              <View style={styles.universityList}>
                {universities.map((uni) => (
                  <TouchableOpacity
                    key={uni}
                    style={[
                      styles.universityItem,
                      {
                        backgroundColor: university === uni ? colors.primary + '15' : colors.surfaceSecondary,
                        borderColor: university === uni ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setUniversity(uni)}
                  >
                    <Text
                      style={{
                        color: university === uni ? colors.primary : colors.text,
                        fontWeight: university === uni ? '600' : '400',
                        flex: 1,
                      }}
                    >
                      {uni}
                    </Text>
                    {university === uni && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.university && (
              <Text style={{ color: colors.danger, fontSize: fonts.sm, marginBottom: Spacing.sm }}>
                {errors.university}
              </Text>
            )}
            <Input label={t.auth.course} value={course} onChangeText={setCourse} icon="book-outline" />
          </>
        );
      case 4:
        return (
          <>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fonts.lg }]}>
              {t.auth.chooseAvatar}
            </Text>
            {optionsLoading ? (
              <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md }}>
                {t.common.loading}
              </Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {AVATAR_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.categoryChip, { backgroundColor: selectedCategory === cat.key ? colors.primary : colors.surfaceSecondary }]}
                      onPress={() => setSelectedCategory(cat.key)}
                    >
                      <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                      <Text style={{ color: selectedCategory === cat.key ? '#FFF' : colors.text, fontSize: 12, fontWeight: '500' }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.avatarGrid}>
                  {(avatarCategories[selectedCategory] || []).map((id) => (
                    <TouchableOpacity key={id} onPress={() => setAvatarId(id)} style={[styles.avatarItem, avatarId === id && { borderColor: colors.primary, borderWidth: 3 }]}>
                      <Avatar avatarId={id} size={64} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        );
      case 5:
        return (
          <>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fonts.xl }]}>
              {t.auth.verifyEmail}
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              {t.auth.verifySubtitle}
            </Text>
            <View style={[styles.emailBadge, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={[styles.emailBadgeText, { color: colors.primary, fontSize: fonts.sm }]}>
                {t.auth.codeSentTo} {email.trim().toLowerCase()}
              </Text>
            </View>
            {codeExpiresAt && (
              <Text style={[
                styles.timerText,
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
              onChangeText={(v) => setVerifyCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              icon="key-outline"
              error={errors.verifyCode}
            />
            <TouchableOpacity
              onPress={handleResend}
              style={styles.resendButton}
              disabled={resendCooldown > 0}
            >
              <Text style={{
                color: resendCooldown > 0 ? colors.textTertiary : colors.primary,
                fontWeight: '500',
              }}>
                {resendCooldown > 0
                  ? `${t.auth.resendIn} ${resendCooldown}s`
                  : t.auth.resendCode}
              </Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.topBar}>
          {step > 1 && step < 5 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          {step < 5 && <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS - 1} />}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {renderStep()}
        </ScrollView>

        <View style={styles.bottomBar}>
          {formError ? (
            <View style={[styles.errorBox, { backgroundColor: colors.danger + '15' }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
            </View>
          ) : null}
          <Button
            title={step === 5 ? t.auth.finish : step === 4 ? t.auth.next : t.auth.next}
            onPress={handleNext}
            loading={loading}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  backButton: { marginBottom: Spacing.sm },
  scroll: { padding: Spacing.lg, flexGrow: 1 },
  stepTitle: { fontWeight: '700', marginBottom: Spacing.sm },
  stepSubtitle: { marginBottom: Spacing.lg, lineHeight: 22 },
  bottomBar: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  strengthContainer: { marginBottom: Spacing.md, marginTop: -Spacing.sm },
  strengthTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  universityList: { marginBottom: Spacing.md },
  universityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  errorBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  errorText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  categoryScroll: { marginBottom: Spacing.lg },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, marginRight: Spacing.sm },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center' },
  avatarItem: { borderRadius: 40, padding: 4, borderWidth: 3, borderColor: 'transparent' },
  resendButton: { alignItems: 'center', paddingVertical: Spacing.md },
  hint: { marginTop: -Spacing.sm, marginBottom: Spacing.md, lineHeight: 18 },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  emailBadgeText: { fontWeight: '500', flex: 1 },
  timerText: { marginBottom: Spacing.md, fontWeight: '600' },
});
