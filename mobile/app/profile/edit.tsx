import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Avatar } from '../../src/components/Avatar';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { validateUsername, validateMobileNumber } from '../../src/utils/validation';
import { Spacing, BorderRadius } from '../../src/theme';

const AVATAR_CATEGORIES = [
  { key: 'animals', label: 'Animals' },
  { key: 'nature', label: 'Nature' },
  { key: 'technology', label: 'Tech' },
  { key: 'sports', label: 'Sports' },
  { key: 'education', label: 'Education' },
  { key: 'minimal', label: 'Minimal' },
];

export default function EditProfileScreen() {
  const { user, updateUser, loadUser } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();

  const initial = useMemo(() => ({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    university: user?.university || '',
    course: user?.course || '',
    statusMessage: user?.statusMessage || '',
    mobileNumber: user?.mobileNumber || '',
    avatarId: user?.avatarId || 'avatar-1',
  }), [user]);

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [university, setUniversity] = useState(initial.university);
  const [course, setCourse] = useState(initial.course);
  const [statusMessage, setStatusMessage] = useState(initial.statusMessage);
  const [mobileNumber, setMobileNumber] = useState(initial.mobileNumber);
  const [avatarId, setAvatarId] = useState(initial.avatarId);
  const [avatarCategories, setAvatarCategories] = useState<Record<string, string[]>>({});
  const [universities, setUniversities] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('animals');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getAvatars().then((r) => setAvatarCategories(r.categories)).catch(() => {});
    api.getUniversities().then((r) => setUniversities(r.universities)).catch(() => {});
  }, []);

  const hasChanges =
    firstName !== initial.firstName ||
    lastName !== initial.lastName ||
    username !== initial.username ||
    bio !== initial.bio ||
    university !== initial.university ||
    course !== initial.course ||
    statusMessage !== initial.statusMessage ||
    mobileNumber !== initial.mobileNumber ||
    avatarId !== initial.avatarId;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim() || firstName.trim().length < 2) newErrors.firstName = 'At least 2 characters';
    if (!lastName.trim() || lastName.trim().length < 2) newErrors.lastName = 'At least 2 characters';
    const usernameError = validateUsername(username);
    if (usernameError) newErrors.username = usernameError;
    if (mobileNumber.trim()) {
      const phoneError = validateMobileNumber(mobileNumber);
      if (phoneError) newErrors.mobileNumber = phoneError;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!hasChanges) {
      Alert.alert('', t.profile.noChanges);
      return;
    }
    if (!validate()) return;

    if (username.trim().toLowerCase() !== initial.username) {
      try {
        const check = await api.checkUsernameAvailable(username.trim());
        if (!check.available) {
          setErrors({ username: 'Username already taken' });
          return;
        }
      } catch {
        // proceed — server will validate
      }
    }

    setLoading(true);
    try {
      const updated = await api.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        university: university || undefined,
        course: course.trim() || undefined,
        statusMessage: statusMessage.trim() || undefined,
        mobileNumber: mobileNumber.trim() || '',
        avatarId,
      }) as Record<string, unknown>;
      updateUser(updated as Parameters<typeof updateUser>[0]);
      await loadUser();
      Alert.alert('Success', t.profile.saved, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.md }}>{t.profile.cancel}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fonts.lg }]}>
          {t.profile.edit}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <Avatar avatarId={avatarId} size={88} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {AVATAR_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryChip, { backgroundColor: selectedCategory === cat.key ? colors.primary : colors.surfaceSecondary }]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text style={{ color: selectedCategory === cat.key ? '#FFF' : colors.text, fontSize: 12, fontWeight: '500' }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.avatarGrid}>
            {(avatarCategories[selectedCategory] || []).map((id) => (
              <TouchableOpacity
                key={id}
                onPress={() => setAvatarId(id)}
                style={[styles.avatarItem, avatarId === id && { borderColor: colors.primary, borderWidth: 3 }]}
              >
                <Avatar avatarId={id} size={52} />
              </TouchableOpacity>
            ))}
          </View>

          <Input label={t.auth.firstName} value={firstName} onChangeText={setFirstName} error={errors.firstName} />
          <Input label={t.auth.lastName} value={lastName} onChangeText={setLastName} error={errors.lastName} />
          <Input
            label={t.auth.username}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            icon="at-outline"
            error={errors.username}
          />
          <Input label={t.profile.bio} value={bio} onChangeText={setBio} multiline maxLength={200} />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: fonts.sm }]}>
            {t.profile.education}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.uniScroll}>
            {universities.map((uni) => (
              <TouchableOpacity
                key={uni}
                style={[styles.uniChip, {
                  backgroundColor: university === uni ? colors.primary + '15' : colors.surfaceSecondary,
                  borderColor: university === uni ? colors.primary : colors.border,
                }]}
                onPress={() => setUniversity(uni)}
              >
                <Text style={{ color: university === uni ? colors.primary : colors.text, fontSize: fonts.xs }}>
                  {uni}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Input label={t.auth.course} value={course} onChangeText={setCourse} icon="book-outline" />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: fonts.sm }]}>
            {t.profile.privateInfo}
          </Text>
          <View style={[styles.privateNote, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, flex: 1 }}>
              {t.profile.privateOnly}
            </Text>
          </View>
          <Input
            label={t.profile.mobileNumber}
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            icon="call-outline"
            error={errors.mobileNumber}
            placeholder="+254712345678"
          />
          <Text style={[styles.hint, { color: colors.textTertiary, fontSize: fonts.xs }]}>
            {t.profile.mobileHint}
          </Text>

          <Input label={t.profile.status} value={statusMessage} onChangeText={setStatusMessage} maxLength={100} />

          <Button
            title={t.profile.save}
            onPress={handleSave}
            loading={loading}
            disabled={!hasChanges}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: { fontWeight: '700' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.md },
  categoryScroll: { marginBottom: Spacing.md },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  avatarItem: { borderRadius: 30, padding: 2, borderWidth: 3, borderColor: 'transparent' },
  sectionLabel: { fontWeight: '600', marginBottom: Spacing.sm, marginTop: Spacing.sm },
  uniScroll: { marginBottom: Spacing.md, maxHeight: 44 },
  uniChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  privateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  hint: { marginTop: -Spacing.sm, marginBottom: Spacing.md },
});
