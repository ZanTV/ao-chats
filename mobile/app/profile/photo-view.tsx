import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { api } from '../../src/services/api';
import { getAccessToken } from '../../src/services/storage';
import {
  getCachedPublicProfile,
  setCachedPublicProfile,
  type PublicProfileCache,
} from '../../src/cache/profileCache';
import { hasValidAvatarUrl, resolveAvatarDisplayUrl } from '../../src/utils/avatarUrl';
import { useAvatarSyncStore } from '../../src/profile/avatarSyncStore';
import { Spacing } from '../../src/theme';

const SCREEN_W = Dimensions.get('window').width;

/**
 * Minimal profile photo viewer — own or friend (public fields only).
 */
export default function ProfilePhotoViewScreen() {
  const params = useLocalSearchParams<{
    userId: string;
    avatarId?: string;
    imageUrl?: string;
    imageVersion?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }>();
  const userId = String(params.userId || '');
  const { colors, fonts, t } = useSettingsStore();
  const me = useAuthStore((s) => s.user);

  const seed: PublicProfileCache | null = userId
    ? getCachedPublicProfile(userId) ||
      (me?.id === userId
        ? {
            id: me.id,
            username: me.username,
            firstName: me.firstName,
            lastName: me.lastName,
            avatarId: me.avatarId || 'avatar-1',
            avatarUrl: me.avatarUrl,
            avatarVersion: me.avatarVersion,
          }
        : {
            id: userId,
            username: String(params.username || ''),
            firstName: String(params.firstName || ''),
            lastName: String(params.lastName || ''),
            avatarId: String(params.avatarId || 'avatar-1'),
            avatarUrl: params.imageUrl || null,
            avatarVersion: Number(params.imageVersion || 0) || 0,
          })
    : null;

  const [profile, setProfile] = useState<PublicProfileCache | null>(seed);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        if (me?.id === userId) {
          const remote = (await api.getProfile()) as PublicProfileCache & { id?: string };
          if (cancelled) return;
          const next = {
            id: remote.id || userId,
            username: remote.username,
            firstName: remote.firstName,
            lastName: remote.lastName,
            avatarId: remote.avatarId || 'avatar-1',
            avatarUrl: remote.avatarUrl,
            avatarVersion: remote.avatarVersion,
            isVerified: remote.isVerified,
          };
          setProfile(next);
          setCachedPublicProfile(next);
          return;
        }
        const remote = (await api.getUser(userId)) as PublicProfileCache;
        if (cancelled) return;
        setProfile(remote);
        setCachedPublicProfile(remote);
      } catch {
        // keep seed / cache
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, me?.id]);

  const synced = useAvatarSyncStore((s) => (userId ? s.byUserId[userId] : undefined));
  const resolvedUrl =
    synced?.urlKnown && typeof synced.avatarVersion === 'number'
      ? synced.avatarVersion >= (profile?.avatarVersion ?? 0)
        ? synced.avatarUrl
        : profile?.avatarUrl
      : profile?.avatarUrl;
  const resolvedVersion =
    synced?.urlKnown && synced.avatarVersion >= (profile?.avatarVersion ?? 0)
      ? synced.avatarVersion
      : profile?.avatarVersion;
  const displayUrl = resolveAvatarDisplayUrl(resolvedUrl, resolvedVersion);

  useEffect(() => {
    setImageFailed(false);
    if (!hasValidAvatarUrl(displayUrl)) {
      setAuthHeaders(undefined);
      return;
    }
    let cancelled = false;
    getAccessToken().then((token) => {
      if (!cancelled && token) setAuthHeaders({ Authorization: `Bearer ${token}` });
    });
    return () => {
      cancelled = true;
    };
  }, [displayUrl]);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  const showPhoto = hasValidAvatarUrl(displayUrl) && !imageFailed;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0B0B0C' }]} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel="Close">
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.meta}>
          <Text style={[styles.name, { fontSize: fonts.md }]} numberOfLines={1}>
            {profile.firstName} {profile.lastName}
          </Text>
          {profile.username ? (
            <Text style={[styles.username, { fontSize: fonts.xs }]} numberOfLines={1}>
              @{profile.username}
            </Text>
          ) : null}
        </View>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.stage}>
        {showPhoto ? (
          <Image
            source={{ uri: displayUrl!, headers: authHeaders }}
            style={styles.photo}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Avatar
            userId={profile.id}
            avatarId={profile.avatarId || 'avatar-1'}
            imageUrl={null}
            size={Math.min(SCREEN_W * 0.55, 220)}
          />
        )}
      </View>

      <Text style={[styles.hint, { color: colors.textTertiary, fontSize: fonts.xs }]}>
        {t.profile.photoMenuTitle}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, alignItems: 'center' },
  name: { color: '#fff', fontWeight: '700' },
  username: { color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  photo: { width: SCREEN_W, height: SCREEN_W, maxHeight: '80%' },
  hint: { textAlign: 'center', paddingBottom: Spacing.lg },
});
