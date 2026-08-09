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
import { Spacing, BorderRadius } from '../../src/theme';

export default function AvatarPhotoPreviewScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const { user, updateUser } = useAuthStore();
  const [uri, setUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const pending = peekPendingAvatarPhoto();
    if (!pending?.localUri) {
      router.back();
      return;
    }
    setUri(pending.localUri);
  }, []);

  const handleCancel = () => {
    setPendingAvatarPhoto(null);
    router.back();
  };

  const handleSave = async () => {
    const pending = takePendingAvatarPhoto();
    if (!pending || saving) return;
    setSaving(true);
    try {
      const updated = await uploadProfileAvatar(pending, (p) => setProgress(p));
      updateUser(updated);
      if (updated.id) {
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
      }
      Alert.alert('', t.profile.photoSaved, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      setPendingAvatarPhoto(pending);
      Alert.alert(
        t.common.error,
        err instanceof Error ? err.message : t.profile.photoFailed
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} disabled={saving}>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.md }}>{t.profile.cancel}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.lg }]}>
          {t.profile.photoPreview}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || !uri}>
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
