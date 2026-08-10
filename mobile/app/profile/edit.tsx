import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Avatar } from '../../src/components/Avatar';
import { UniversityPicker } from '../../src/components/UniversityPicker';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { loadAvatarCategories, loadUniversities } from '../../src/services/signupOptions';
import { validateUsername, validateMobileNumber } from '../../src/utils/validation';
import { setPendingAvatarPhoto } from '../../src/profile/pendingAvatarPhoto';
import { kindFromMimeClient, validatePendingAttachment } from '../../src/attachments/pending';
import { invalidatePublicProfile, setCachedPublicProfile } from '../../src/cache/profileCache';
import { applyAvatarSyncUpdate } from '../../src/profile/avatarSyncStore';
import { hasValidAvatarUrl } from '../../src/utils/avatarUrl';
import { ProfileSaveSuccessToast } from '../../src/components/ProfileSaveSuccessToast';
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
  const [selectedAvatarId, setSelectedAvatarId] = useState(initial.avatarId);
  const [avatarCategories, setAvatarCategories] = useState<Record<string, string[]>>({});
  const [universities, setUniversities] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('animals');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clearingPhoto, setClearingPhoto] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [needsAvatarPick, setNeedsAvatarPick] = useState(false);
  const [avatarTouched, setAvatarTouched] = useState(false);
  /**
   * When true, preview the selected AO avatar instead of a real photo.
   * Only set after remove-photo or picking an AO avatar (which clears photo on save).
   * Default/current profile state always prefers a valid avatarUrl.
   */
  const [previewAoAvatar, setPreviewAoAvatar] = useState(
    () => !hasValidAvatarUrl(user?.avatarUrl)
  );
  /** Draft AO selection should not be wiped by a same-URL profile refresh. */
  const aoDraftPreviewRef = useRef(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    loadAvatarCategories().then(setAvatarCategories);
    loadUniversities().then(setUniversities);
  }, []);

  // Keep preview aligned with authoritative profile photo (upload/clear/sync)
  useEffect(() => {
    if (hasValidAvatarUrl(user?.avatarUrl)) {
      if (aoDraftPreviewRef.current) return;
      setPreviewAoAvatar(false);
    } else {
      aoDraftPreviewRef.current = false;
      setPreviewAoAvatar(true);
    }
  }, [user?.avatarUrl, user?.avatarVersion]);

  const showRealPhotoPreview = hasValidAvatarUrl(user?.avatarUrl) && !previewAoAvatar;

  const pickProfilePhoto = async () => {
    aoDraftPreviewRef.current = false;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.common.error, "You don't have permission to access photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const file = {
      localUri: asset.uri,
      mimeType: mime,
      fileName: asset.fileName || 'avatar.jpg',
      fileSize: asset.fileSize || 0,
      kind: kindFromMimeClient(mime),
      width: asset.width,
      height: asset.height,
      previewUri: asset.uri,
    };
    const err = validatePendingAttachment(file);
    if (err) {
      Alert.alert(t.common.error, err);
      return;
    }
    setPendingAvatarPhoto(file);
    router.push('/profile/avatar-photo' as any);
  };

  const confirmRemoveCustomPhoto = async () => {
    if (!hasValidAvatarUrl(user?.avatarUrl) || clearingPhoto) return;
    setClearingPhoto(true);
    try {
      const updated = (await api.clearProfileAvatar()) as Parameters<typeof updateUser>[0];
      updateUser(updated);
      if (updated.id) {
        applyAvatarSyncUpdate({
          userId: updated.id,
          avatarUrl: null,
          avatarVersion: updated.avatarVersion ?? 0,
        });
        invalidatePublicProfile(updated.id);
        setCachedPublicProfile({
          id: updated.id,
          username: updated.username || '',
          firstName: updated.firstName || '',
          lastName: updated.lastName || '',
          avatarId: updated.avatarId || selectedAvatarId || 'avatar-1',
          avatarUrl: null,
          avatarVersion: updated.avatarVersion,
        });
      }
      setPreviewAoAvatar(true);
      setNeedsAvatarPick(true);
      setAvatarTouched(false);
      aoDraftPreviewRef.current = false;
      setShowRemoveConfirm(false);
      Alert.alert('', t.profile.photoRemoved);
    } catch (err) {
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.profile.photoFailed);
    } finally {
      setClearingPhoto(false);
    }
  };

  const selectAoAvatar = (id: string) => {
    setSelectedAvatarId(id);
    setAvatarTouched(true);
    // Selecting AO avatar previews AO and will clear avatarUrl on save
    aoDraftPreviewRef.current = true;
    setPreviewAoAvatar(true);
  };

  const hasChanges =
    firstName !== initial.firstName ||
    lastName !== initial.lastName ||
    username !== initial.username ||
    bio !== initial.bio ||
    university !== initial.university ||
    course !== initial.course ||
    statusMessage !== initial.statusMessage ||
    mobileNumber !== initial.mobileNumber ||
    selectedAvatarId !== initial.avatarId ||
    (needsAvatarPick && avatarTouched);

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
    if (needsAvatarPick && !avatarTouched) {
      Alert.alert('', t.profile.chooseAvatar);
      return;
    }
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
        avatarId: selectedAvatarId,
      }) as Record<string, unknown>;
      updateUser(updated as Parameters<typeof updateUser>[0]);
      if (typeof updated.id === 'string') {
        invalidatePublicProfile(updated.id);
        applyAvatarSyncUpdate({
          userId: updated.id,
          avatarUrl: (updated.avatarUrl as string | null | undefined) ?? null,
          avatarVersion:
            typeof updated.avatarVersion === 'number'
              ? updated.avatarVersion
              : user?.avatarVersion ?? 0,
        });
      }
      const refreshed = await loadUser();
      if (!refreshed) {
        // Local update already applied — still treat as saved
      }
      setNeedsAvatarPick(false);
      setAvatarTouched(false);
      aoDraftPreviewRef.current = false;
      setPreviewAoAvatar(!hasValidAvatarUrl((updated as { avatarUrl?: string | null }).avatarUrl));
      setShowSaveSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? (/unexpected/i.test(err.message)
              ? 'Could not save your profile. Please try again.'
              : err.message)
          : t.common.error;
      Alert.alert('Error', message);
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
            <Avatar
              userId={showRealPhotoPreview ? user?.id : undefined}
              avatarId={selectedAvatarId}
              imageUrl={showRealPhotoPreview ? user?.avatarUrl : null}
              imageVersion={user?.avatarVersion}
              size={88}
            />
            <TouchableOpacity
              style={[styles.changePhotoBtn, { backgroundColor: colors.surfaceSecondary }]}
              onPress={pickProfilePhoto}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: fonts.sm, fontWeight: '600' }}>
                {t.profile.changePhoto}
              </Text>
            </TouchableOpacity>
            {showRealPhotoPreview ? (
              <TouchableOpacity
                onPress={() => setShowRemoveConfirm(true)}
                disabled={clearingPhoto}
                style={{ marginTop: Spacing.xs }}
              >
                <Text style={{ color: colors.danger, fontSize: fonts.xs }}>
                  {clearingPhoto ? t.common.loading : t.profile.removePhoto}
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: needsAvatarPick ? colors.primary : colors.textSecondary,
                  fontSize: fonts.sm,
                  marginTop: Spacing.md,
                },
              ]}
            >
              {needsAvatarPick || !showRealPhotoPreview
                ? t.profile.chooseAvatar
                : t.profile.useAoAvatar}
            </Text>
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
            {(avatarCategories[selectedCategory] || []).map((id) => {
              const isSelected = selectedAvatarId === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => selectAoAvatar(id)}
                  style={[
                    styles.avatarItem,
                    {
                      borderColor: isSelected ? colors.primary : 'transparent',
                      borderWidth: 3,
                    },
                  ]}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Avatar avatarId={id} size={52} />
                  {isSelected ? (
                    <View style={[styles.avatarCheck, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
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
          <UniversityPicker
            label={t.auth.university}
            value={university}
            onChange={setUniversity}
            universities={universities}
            placeholder="Tap to choose your university"
          />
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

      <ConfirmDialog
        visible={showRemoveConfirm}
        title={t.profile.removePhoto}
        message={t.profile.removePhotoConfirm}
        confirmLabel={t.profile.removePhoto}
        cancelLabel={t.common.cancel}
        destructive
        busy={clearingPhoto}
        onConfirm={confirmRemoveCustomPhoto}
        onCancel={() => setShowRemoveConfirm(false)}
        colors={colors}
        fonts={fonts}
      />

      <ProfileSaveSuccessToast
        visible={showSaveSuccess}
        message={t.profile.saved}
        colors={colors}
        fonts={fonts}
        onDone={() => {
          setShowSaveSuccess(false);
          router.back();
        }}
      />
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
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
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
  avatarItem: {
    borderRadius: 30,
    padding: 2,
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  avatarCheck: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  sectionLabel: { fontWeight: '600', marginBottom: Spacing.sm, marginTop: Spacing.sm },
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
