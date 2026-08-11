import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '../../src/components/Input';
import { Avatar } from '../../src/components/Avatar';
import { UniversityPicker } from '../../src/components/UniversityPicker';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { loadAvatarCategories, loadUniversities } from '../../src/services/signupOptions';
import { validateUsername, validateMobileNumber } from '../../src/utils/validation';
import { invalidatePublicProfile, setCachedPublicProfile } from '../../src/cache/profileCache';
import { applyAvatarSyncUpdate } from '../../src/profile/avatarSyncStore';
import { hasValidAvatarUrl, resolveAvatarDisplayUrl } from '../../src/utils/avatarUrl';
import { resolveAvatar } from '../../src/profile/resolveAvatar';
import { getAccessToken } from '../../src/services/storage';
import { ProfileSaveSuccessToast } from '../../src/components/ProfileSaveSuccessToast';
import { Spacing, BorderRadius } from '../../src/theme';

type GalleryPhoto = {
  id: string;
  url: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
};

const AVATAR_CATEGORIES = [
  { key: 'animals', labelKey: 'animals' as const },
  { key: 'nature', labelKey: 'nature' as const },
  { key: 'technology', labelKey: 'tech' as const },
  { key: 'sports', labelKey: 'sports' as const },
  { key: 'education', labelKey: 'education' as const },
  { key: 'minimal', labelKey: 'minimal' as const },
  { key: 'own', labelKey: 'myOwnDp' as const },
];

/** My Own DP library hard cap — Browse hides at this count. */
const MAX_OWN_DPS = 4;

export default function EditProfileScreen() {
  const { user, updateUser, loadUser } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();

  const initial = useMemo(
    () => ({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      username: user?.username || '',
      bio: user?.bio || '',
      university: user?.university || '',
      course: user?.course || '',
      statusMessage: user?.statusMessage || '',
      mobileNumber: user?.mobileNumber || '',
      avatarId: user?.avatarId || 'avatar-1',
    }),
    [user]
  );

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
  const [selectedCategory, setSelectedCategory] = useState(
    hasValidAvatarUrl(user?.avatarUrl) ? 'own' : 'animals'
  );
  const [ownDps, setOwnDps] = useState<GalleryPhoto[]>([]);
  const [selectedOwnDpId, setSelectedOwnDpId] = useState<string | null>(null);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>();
  const [loading, setLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clearingPhoto, setClearingPhoto] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pendingDeleteOwnDpId, setPendingDeleteOwnDpId] = useState<string | null>(null);
  const [deletingOwnDp, setDeletingOwnDp] = useState(false);
  const [needsAvatarPick, setNeedsAvatarPick] = useState(false);
  const [avatarTouched, setAvatarTouched] = useState(false);
  const [previewAoAvatar, setPreviewAoAvatar] = useState(
    () => !hasValidAvatarUrl(user?.avatarUrl)
  );
  const aoDraftPreviewRef = useRef(false);
  const lastAvatarVersionRef = useRef(user?.avatarVersion ?? 0);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const categoryLabel = useCallback(
    (key: (typeof AVATAR_CATEGORIES)[number]['labelKey']) => {
      const map = t.profile.avatarNav || {};
      return map[key] || key;
    },
    [t]
  );

  const refreshGallery = useCallback(async () => {
    try {
      const res = await api.getAvatarGallery();
      setOwnDps(res.photos || []);
    } catch {
      setOwnDps([]);
    }
  }, []);

  useEffect(() => {
    loadAvatarCategories().then(setAvatarCategories);
    loadUniversities().then(setUniversities);
    void refreshGallery();
    getAccessToken().then((token) => {
      if (token) setAuthHeaders({ Authorization: `Bearer ${token}` });
    });
  }, [refreshGallery]);

  useEffect(() => {
    const version = user?.avatarVersion ?? 0;
    const versionBumped = version > lastAvatarVersionRef.current;
    lastAvatarVersionRef.current = version;

    if (hasValidAvatarUrl(user?.avatarUrl)) {
      if (versionBumped || !aoDraftPreviewRef.current) {
        aoDraftPreviewRef.current = false;
        setPreviewAoAvatar(false);
        if (versionBumped) setSelectedOwnDpId(null);
      }
    } else {
      aoDraftPreviewRef.current = false;
      setPreviewAoAvatar(true);
    }
  }, [user?.avatarUrl, user?.avatarVersion]);

  const selectedOwnDp = useMemo(
    () => ownDps.find((d) => d.id === selectedOwnDpId) || null,
    [ownDps, selectedOwnDpId]
  );

  // Current saved profile visual (ignores AO draft / Own DP selection preview)
  const savedResolved = resolveAvatar({
    avatarId: user?.avatarId || selectedAvatarId,
    avatarUrl: user?.avatarUrl,
    avatarVersion: user?.avatarVersion,
  });
  const showRealPhotoPreview =
    !selectedOwnDp && savedResolved.type === 'photo' && !previewAoAvatar;

  /** Tick gallery item that matches current active profile photo URL */
  const activeGalleryId = useMemo(() => {
    if (!hasValidAvatarUrl(user?.avatarUrl) || previewAoAvatar || selectedOwnDpId) return null;
    const current = resolveAvatarDisplayUrl(user?.avatarUrl, user?.avatarVersion);
    const match = ownDps.find((p) => {
      const a = resolveAvatarDisplayUrl(p.url, user?.avatarVersion);
      return a && current && a.split('?')[0] === current.split('?')[0];
    });
    return match?.id || null;
  }, [ownDps, user?.avatarUrl, user?.avatarVersion, previewAoAvatar, selectedOwnDpId]);

  const browseOwnDps = async () => {
    const remaining = MAX_OWN_DPS - ownDps.length;
    if (remaining <= 0) {
      Alert.alert('', t.profile.ownDpFull);
      return;
    }
    setBrowsing(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t.common.error, "You don't have permission to access photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
      if (result.canceled || !result.assets?.length) return;

      const assets = result.assets.slice(0, remaining);
      const uploaded = await api.uploadAvatarGallery(
        assets.map((asset) => ({
          localUri: asset.uri,
          mimeType: asset.mimeType || 'image/jpeg',
          fileName: asset.fileName || 'avatar.jpg',
        }))
      );
      await refreshGallery();
      const first = uploaded.photos?.[0];
      if (first?.id) selectOwnDp(first.id);
      setSelectedCategory('own');
    } catch (err) {
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.profile.photoFailed);
    } finally {
      setBrowsing(false);
    }
  };

  const selectOwnDp = (id: string) => {
    setSelectedOwnDpId(id);
    setAvatarTouched(true);
    aoDraftPreviewRef.current = false;
    setPreviewAoAvatar(false);
    setNeedsAvatarPick(false);
  };

  const deleteOwnDp = (id: string) => {
    setPendingDeleteOwnDpId(id);
  };

  const confirmDeleteOwnDp = async () => {
    const id = pendingDeleteOwnDpId;
    if (!id || deletingOwnDp) return;
    setDeletingOwnDp(true);
    // Remove from UI immediately so ✕ feels permanent
    setOwnDps((prev) => prev.filter((p) => p.id !== id));
    if (selectedOwnDpId === id) setSelectedOwnDpId(null);
    setPendingDeleteOwnDpId(null);
    try {
      const result = await api.deleteAvatarGalleryPhoto(id);

      if (result.clearedAvatar && result.profile) {
        updateUser(result.profile as Parameters<typeof updateUser>[0]);
        applyAvatarSyncUpdate({
          userId: result.profile.id,
          avatarUrl: null,
          avatarVersion: result.profile.avatarVersion ?? 0,
        });
        invalidatePublicProfile(result.profile.id);
        setCachedPublicProfile({
          id: result.profile.id,
          username: result.profile.username || '',
          firstName: result.profile.firstName || '',
          lastName: result.profile.lastName || '',
          avatarId: result.profile.avatarId || selectedAvatarId || 'avatar-1',
          avatarUrl: null,
          avatarVersion: result.profile.avatarVersion,
        });
        setPreviewAoAvatar(true);
        aoDraftPreviewRef.current = false;
      }

      await refreshGallery();
    } catch (err) {
      await refreshGallery();
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.common.error);
    } finally {
      setDeletingOwnDp(false);
    }
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
      setSelectedOwnDpId(null);
      setPreviewAoAvatar(true);
      setNeedsAvatarPick(true);
      setAvatarTouched(false);
      aoDraftPreviewRef.current = false;
      setSelectedCategory('animals');
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
    setSelectedOwnDpId(null);
    setAvatarTouched(true);
    aoDraftPreviewRef.current = true;
    setPreviewAoAvatar(true);
    setNeedsAvatarPick(false);
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
    Boolean(selectedOwnDpId) ||
    (needsAvatarPick && avatarTouched) ||
    (previewAoAvatar && avatarTouched && selectedAvatarId !== initial.avatarId);

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
    if (needsAvatarPick && !avatarTouched && !selectedOwnDpId) {
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
      // Apply selected Agrohub gallery photo as profile — replaces previous avatarUrl in DB
      if (selectedOwnDp) {
        const updatedPhoto = (await api.useAvatarGalleryPhoto(selectedOwnDp.id)) as Parameters<
          typeof updateUser
        >[0];
        updateUser(updatedPhoto);
        if (updatedPhoto.id) {
          applyAvatarSyncUpdate({
            userId: updatedPhoto.id,
            avatarUrl: updatedPhoto.avatarUrl ?? null,
            avatarVersion: updatedPhoto.avatarVersion ?? 0,
          });
          invalidatePublicProfile(updatedPhoto.id);
          setCachedPublicProfile({
            id: updatedPhoto.id,
            username: updatedPhoto.username || '',
            firstName: updatedPhoto.firstName || '',
            lastName: updatedPhoto.lastName || '',
            avatarId: updatedPhoto.avatarId || 'avatar-1',
            avatarUrl: updatedPhoto.avatarUrl ?? null,
            avatarVersion: updatedPhoto.avatarVersion,
            university: updatedPhoto.university,
            course: updatedPhoto.course,
            bio: updatedPhoto.bio,
            status: updatedPhoto.status,
            statusMessage: updatedPhoto.statusMessage,
            lastSeen: updatedPhoto.lastSeen,
            isVerified: updatedPhoto.isVerified,
          });
        }
        aoDraftPreviewRef.current = false;
        setPreviewAoAvatar(false);
      }

      const profilePayload: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        university: university || undefined,
        course: course.trim() || undefined,
        statusMessage: statusMessage.trim() || undefined,
        mobileNumber: mobileNumber.trim() || '',
      };

      // Only send avatarId when user picked an AO avatar (clears custom photo on server)
      if (!selectedOwnDp && (aoDraftPreviewRef.current || (avatarTouched && previewAoAvatar))) {
        profilePayload.avatarId = selectedAvatarId;
      }

      const updated = (await api.updateProfile(profilePayload)) as Record<string, unknown>;
      updateUser(updated as Parameters<typeof updateUser>[0]);
      if (typeof updated.id === 'string') {
        invalidatePublicProfile(updated.id);
        if (profilePayload.avatarId) {
          applyAvatarSyncUpdate({
            userId: updated.id,
            avatarUrl: (updated.avatarUrl as string | null | undefined) ?? null,
            avatarVersion:
              typeof updated.avatarVersion === 'number'
                ? updated.avatarVersion
                : user?.avatarVersion ?? 0,
          });
        }
      }
      await loadUser();
      setNeedsAvatarPick(false);
      setAvatarTouched(false);
      setSelectedOwnDpId(null);
      aoDraftPreviewRef.current = false;
      setPreviewAoAvatar(!hasValidAvatarUrl(useAuthStore.getState().user?.avatarUrl));
      setShowSaveSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? /unexpected/i.test(err.message)
            ? 'Could not save your profile. Please try again.'
            : err.message
          : t.common.error;
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerSide, styles.headerSideLeft]}
          hitSlop={8}
        >
          <Text style={{ color: colors.textSecondary, fontSize: fonts.md }}>{t.profile.cancel}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fonts.lg }]} numberOfLines={1}>
          {t.profile.edit}
        </Text>
        {hasChanges ? (
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={[styles.headerSide, styles.headerSideRight]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.profile.save}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.headerSave, { color: colors.primary, fontSize: fonts.md }]}>
                {t.profile.save}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.headerSide, styles.headerSideRight]} />
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            {selectedOwnDp ? (
              <View
                style={[
                  styles.previewRing,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Image
                  source={{
                    uri: resolveAvatarDisplayUrl(selectedOwnDp.url, user?.avatarVersion) || selectedOwnDp.url,
                    headers: authHeaders,
                  }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <Avatar
                userId={showRealPhotoPreview ? user?.id : undefined}
                avatarId={selectedAvatarId}
                imageUrl={showRealPhotoPreview ? user?.avatarUrl : null}
                imageVersion={user?.avatarVersion}
                size={88}
              />
            )}
            {showRealPhotoPreview ? (
              <TouchableOpacity
                onPress={() => setShowRemoveConfirm(true)}
                disabled={clearingPhoto}
                style={{ marginTop: Spacing.sm }}
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
              {t.profile.chooseAvatar}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {AVATAR_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceSecondary,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Text
                    style={{
                      color: active ? '#FFF' : colors.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {categoryLabel(cat.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedCategory === 'own' ? (
            <View style={styles.avatarGrid}>
              {ownDps.length < MAX_OWN_DPS ? (
                <TouchableOpacity
                  onPress={browseOwnDps}
                  disabled={browsing || loading}
                  style={[
                    styles.browseTile,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityLabel={t.profile.browseOwnDp}
                >
                  <Ionicons name="images-outline" size={22} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: fonts.xs,
                      fontWeight: '600',
                      marginTop: 4,
                    }}
                  >
                    {browsing ? t.common.loading : t.profile.browseOwnDp}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {ownDps.map((item) => {
                const isSelected =
                  selectedOwnDpId === item.id ||
                  (!selectedOwnDpId && activeGalleryId === item.id);
                const thumb =
                  resolveAvatarDisplayUrl(item.url, user?.avatarVersion) || item.url;
                return (
                  <View key={item.id} style={styles.ownDpWrap}>
                    <TouchableOpacity
                      onPress={() => selectOwnDp(item.id)}
                      style={[
                        styles.ownDpItem,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: isSelected ? 3 : 1,
                          backgroundColor: colors.surfaceSecondary,
                        },
                      ]}
                      accessibilityState={{ selected: isSelected }}
                    >
                      {authHeaders ? (
                        <Image
                          source={{ uri: thumb, headers: authHeaders }}
                          style={styles.ownDpImage}
                          resizeMode="cover"
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        <View style={[styles.ownDpImage, styles.ownDpPlaceholder]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                      )}
                      {isSelected ? (
                        <View style={[styles.avatarCheck, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteOwnDp(item.id)}
                      style={[styles.removeDpBtn, { backgroundColor: colors.danger }]}
                      hitSlop={10}
                      accessibilityLabel={t.profile.removeOwnDp}
                    >
                      <Ionicons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.avatarGrid}>
              {(avatarCategories[selectedCategory] || []).map((id) => {
                const isSelected = selectedAvatarId === id && previewAoAvatar && !selectedOwnDpId;
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
          )}

          {selectedCategory === 'own' ? (
            <Text style={[styles.hint, { color: colors.textTertiary, fontSize: fonts.xs }]}>
              {t.profile.ownDpHint}
            </Text>
          ) : null}

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
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={Boolean(pendingDeleteOwnDpId)}
        title={t.profile.removeOwnDp}
        message={t.profile.removeOwnDpConfirm}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        destructive
        busy={deletingOwnDp}
        onConfirm={confirmDeleteOwnDp}
        onCancel={() => {
          if (!deletingOwnDp) setPendingDeleteOwnDpId(null);
        }}
        colors={colors}
        fonts={fonts}
      />

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
  headerSide: {
    minWidth: 64,
    justifyContent: 'center',
  },
  headerSideLeft: { alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  headerTitle: { fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: Spacing.sm },
  headerSave: { fontWeight: '700' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.md },
  previewRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    borderWidth: 1,
  },
  previewImage: { width: '100%', height: '100%' },
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
  browseTile: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  ownDpWrap: {
    width: 76,
    height: 76,
    position: 'relative',
  },
  ownDpItem: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownDpImage: {
    width: '100%',
    height: '100%',
  },
  ownDpPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeDpBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 3,
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
  hint: { marginTop: -Spacing.sm, marginBottom: Spacing.md, textAlign: 'center' },
});
