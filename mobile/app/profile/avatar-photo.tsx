import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';
import {
  peekPendingAvatarPhoto,
  takePendingAvatarPhoto,
  setPendingAvatarPhoto,
} from '../../src/profile/pendingAvatarPhoto';
import { uploadProfileAvatar } from '../../src/attachments/uploadProfileAvatar';
import { setCachedPublicProfile, invalidatePublicProfile } from '../../src/cache/profileCache';
import { applyAvatarSyncUpdate } from '../../src/profile/avatarSyncStore';
import { ProfileSaveSuccessToast } from '../../src/components/ProfileSaveSuccessToast';
import { Spacing, BorderRadius } from '../../src/theme';
import type { User } from '../../src/stores/authStore';

export default function AvatarPhotoPreviewScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const { user, updateUser } = useAuthStore();
  const [uri, setUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const pending = peekPendingAvatarPhoto();
    if (!pending?.localUri) {
      router.back();
      return;
    }
    setUri(pending.localUri);
  }, []);

  const handleCancel = () => {
    if (saving || showSuccess) return;
    setPendingAvatarPhoto(null);
    router.back();
  };

  const applySavedProfile = (updated: User, localPreviewUri?: string | null) => {
    if (!updated?.avatarUrl) {
      throw new Error(t.profile.photoSaveFailed);
    }
    // Auth / cache keep the server proxy URL (source of truth for other clients).
    updateUser(updated);
    if (updated.id) {
      // Sync store prefers the local device URI first so AO avatar is replaced instantly.
      applyAvatarSyncUpdate({
        userId: updated.id,
        avatarUrl: localPreviewUri || updated.avatarUrl,
        avatarVersion: updated.avatarVersion ?? 0,
      });
      invalidatePublicProfile(updated.id);
      setCachedPublicProfile({
        id: updated.id,
        username: updated.username,
        firstName: updated.firstName,
        lastName: updated.lastName,
        avatarId: updated.avatarId || 'avatar-1',
        avatarUrl: updated.avatarUrl,
        avatarVersion: updated.avatarVersion,
        university: updated.university,
        course: updated.course,
        bio: updated.bio,
        status: updated.status,
        statusMessage: updated.statusMessage,
        lastSeen: updated.lastSeen,
        isVerified: updated.isVerified,
      });
      // After a short beat, promote sync to the proxy URL (same version) for consistency.
      if (localPreviewUri) {
        const userId = updated.id;
        const remoteUrl = updated.avatarUrl;
        const version = updated.avatarVersion ?? 0;
        setTimeout(() => {
          applyAvatarSyncUpdate({
            userId,
            avatarUrl: remoteUrl,
            avatarVersion: version,
          });
        }, 400);
      }
    }
  };

  const handleSave = async () => {
    const pending = takePendingAvatarPhoto();
    if (!pending || saving || showSuccess) return;
    setSaving(true);
    try {
      const updated = await uploadProfileAvatar(pending, (p) => setProgress(p));
      applySavedProfile(updated, pending.localUri || uri);
      setShowSuccess(true);
    } catch (err) {
      setPendingAvatarPhoto(pending);
      Alert.alert(
        t.common.error,
        err instanceof Error ? err.message : t.profile.photoSaveFailed
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} disabled={saving || showSuccess}>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.md }}>{t.profile.cancel}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.lg }]}>
          {t.profile.photoPreview}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || !uri || showSuccess}>
          <Text style={{ color: colors.primary, fontSize: fonts.md, fontWeight: '600' }}>
            {t.profile.save}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View
          style={[
            styles.previewRing,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            },
          ]}
        >
          {uri ? (
            <Image source={{ uri }} style={styles.previewImage} />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
        {saving ? (
          <Text style={{ color: colors.textSecondary, marginTop: Spacing.lg, fontSize: fonts.sm }}>
            {progress}%
          </Text>
        ) : (
          <Text style={{ color: colors.textTertiary, marginTop: Spacing.lg, fontSize: fonts.sm }}>
            {user?.firstName} {user?.lastName}
          </Text>
        )}
      </View>

      <ProfileSaveSuccessToast
        visible={showSuccess}
        message={t.profile.photoSaved}
        colors={colors}
        fonts={fonts}
        onDone={() => {
          setShowSuccess(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontWeight: '600' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  previewRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', height: '100%' },
});
