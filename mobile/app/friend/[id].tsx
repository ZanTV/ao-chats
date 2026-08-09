import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfilePhotoActions } from '../../src/components/ProfilePhotoActions';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { api } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import {
  getCachedPublicProfile,
  setCachedPublicProfile,
  invalidatePublicProfile,
  type PublicProfileCache,
} from '../../src/cache/profileCache';
import { Spacing, BorderRadius } from '../../src/theme';
import { formatLastSeen } from '../../src/utils/profile';

type MediaSummary = {
  images: number;
  videos: number;
  documents: number;
  links: number;
};

export default function FriendInfoScreen() {
  const { id, conversationId: conversationIdParam } = useLocalSearchParams<{
    id: string;
    conversationId?: string;
  }>();
  const userId = String(id || '');
  const { colors, fonts, t } = useSettingsStore();
  const me = useAuthStore((s) => s.user);

  const cached = userId ? getCachedPublicProfile(userId) : null;
  const [profile, setProfile] = useState<PublicProfileCache | null>(cached);
  const [fromCache, setFromCache] = useState(Boolean(cached));
  const [loading, setLoading] = useState(!cached);
  const [conversationId, setConversationId] = useState(conversationIdParam || '');
  const [summary, setSummary] = useState<MediaSummary | null>(null);
  const [showBlock, setShowBlock] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const remote = (await api.getUser(userId)) as PublicProfileCache;
      setProfile(remote);
      setCachedPublicProfile(remote);
      setFromCache(false);
    } catch {
      const local = getCachedPublicProfile(userId);
      if (local) {
        setProfile(local);
        setFromCache(true);
      } else if (!profile) {
        Alert.alert(t.common.error, t.common.error);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, profile, t]);

  const ensureConversation = useCallback(async () => {
    if (conversationId || !userId) return conversationId;
    try {
      const conv = (await api.getOrCreateConversation(userId)) as { id: string };
      setConversationId(conv.id);
      return conv.id;
    } catch {
      return '';
    }
  }, [conversationId, userId]);

  const loadSummary = useCallback(async (cid: string) => {
    if (!cid) return;
    try {
      const data = await api.getConversationMediaSummary(cid);
      setSummary(data);
    } catch {
      // keep previous / empty
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void (async () => {
      const cid = await ensureConversation();
      if (cid) await loadSummary(cid);
    })();
  }, [loadProfile, ensureConversation, loadSummary]);

  useEffect(() => {
    return socketService.on('profile_updated', (payload: unknown) => {
      const data = payload as { userId?: string; avatarVersion?: number };
      if (!data?.userId || data.userId !== userId) return;
      invalidatePublicProfile(userId);
      void loadProfile();
    });
  }, [userId, loadProfile]);

  const statusLabel = useMemo(() => {
    if (!profile) return '';
    if (profile.isSystemAccount) {
      return profile.statusMessage || 'Official AO Chats Support';
    }
    if (profile.status === 'ONLINE') return t.chat.online;
    if (profile.lastSeen) return formatLastSeen(profile.lastSeen, false);
    return t.chat.offline;
  }, [profile, t]);

  const openShared = async (type: 'image' | 'video' | 'document' | 'link') => {
    const cid = conversationId || (await ensureConversation());
    if (!cid) return;
    router.push({
      pathname: '/friend/shared',
      params: { conversationId: cid, type, userId },
    } as any);
  };

  const handleMessage = async () => {
    const cid = conversationId || (await ensureConversation());
    if (!cid) return;
    router.replace(`/chat/${cid}` as any);
  };

  const confirmBlock = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await api.blockUser(userId);
      if (conversationId) {
        await api.hideConversation(conversationId, { mode: 'remove' });
      }
      invalidatePublicProfile(userId);
      setShowBlock(false);
      router.replace('/(tabs)' as any);
    } catch (err) {
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  const confirmClear = async () => {
    if (!conversationId || busy) return;
    setBusy(true);
    try {
      await api.clearConversation(conversationId);
      setSummary({ images: 0, videos: 0, documents: 0, links: 0 });
      setShowClear(false);
    } catch (err) {
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!conversationId || busy) return;
    setBusy(true);
    try {
      await api.hideConversation(conversationId, { mode: 'delete' });
      setShowDelete(false);
      router.replace('/(tabs)' as any);
    } catch (err) {
      Alert.alert(t.common.error, err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>{t.common.error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.md }}>
          <Text style={{ color: colors.primary }}>{t.common.retry}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const mediaRows = (
    [
      { key: 'image' as const, label: t.friendInfo.photos, icon: 'image-outline' as const, count: summary?.images || 0 },
      { key: 'video' as const, label: t.friendInfo.videos, icon: 'videocam-outline' as const, count: summary?.videos || 0 },
      {
        key: 'document' as const,
        label: t.friendInfo.documents,
        icon: 'document-text-outline' as const,
        count: summary?.documents || 0,
      },
      { key: 'link' as const, label: t.friendInfo.links, icon: 'link-outline' as const, count: summary?.links || 0 },
    ] as const
  ).filter((row) => row.count > 0);

  const isSelf = me?.id === userId;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.nav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text, fontSize: fonts.lg }]}>
          {t.friendInfo.title}
        </Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {fromCache ? (
          <Text style={[styles.cachedBanner, { color: colors.textSecondary, fontSize: fonts.xs }]}>
            {t.friendInfo.offlineCached}
          </Text>
        ) : null}

        <View style={styles.header}>
          <ProfilePhotoActions
            userId={profile.id}
            avatarId={profile.avatarId || 'avatar-1'}
            imageUrl={profile.avatarUrl}
            imageVersion={profile.avatarVersion}
            firstName={profile.firstName}
            lastName={profile.lastName}
            username={profile.username}
            size={104}
            showOnline
            isOnline={profile.status === 'ONLINE'}
            isVerified={profile.isVerified}
          />
          <Text style={[styles.name, { color: colors.text, fontSize: fonts.xl }]}>
            {profile.firstName} {profile.lastName}
          </Text>
          <Text style={[styles.username, { color: colors.textSecondary, fontSize: fonts.md }]}>
            @{profile.username}
          </Text>
          <Text style={[styles.status, { color: colors.textTertiary, fontSize: fonts.sm }]}>
            {statusLabel}
          </Text>
          {profile.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {profile.bio}
            </Text>
          ) : null}
          {(profile.university || profile.course) && (
            <Text style={[styles.meta, { color: colors.textTertiary, fontSize: fonts.xs }]}>
              {[profile.university, profile.course].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {!isSelf && (
          <View style={styles.actionsRow}>
            <ActionChip
              icon="chatbubble-outline"
              label={t.friendInfo.message}
              colors={colors}
              fonts={fonts}
              onPress={handleMessage}
            />
          </View>
        )}

        {mediaRows.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary, fontSize: fonts.xs }]}>
              {t.friendInfo.sharedMedia.toUpperCase()}
            </Text>
            {mediaRows.map((row, index) => (
              <TouchableOpacity
                key={row.key}
                style={[
                  styles.row,
                  index < mediaRows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderLight || colors.border,
                  },
                ]}
                onPress={() => openShared(row.key)}
              >
                <Ionicons name={row.icon} size={22} color={colors.primary} />
                <Text style={[styles.rowLabel, { color: colors.text, fontSize: fonts.md }]}>
                  {row.label}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>{row.count}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isSelf && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary, fontSize: fonts.xs }]}>
              {t.friendInfo.privacy.toUpperCase()}
            </Text>
            <TouchableOpacity style={styles.row} onPress={() => setShowClear(true)}>
              <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text, fontSize: fonts.md }]}>
                {t.friendInfo.clearChat}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              onPress={() => setShowDelete(true)}
            >
              <Ionicons name="close-circle-outline" size={22} color={colors.danger || '#EF4444'} />
              <Text style={[styles.rowLabel, { color: colors.danger || '#EF4444', fontSize: fonts.md }]}>
                {t.friendInfo.deleteChat}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              onPress={() => setShowBlock(true)}
            >
              <Ionicons name="ban-outline" size={22} color={colors.danger || '#EF4444'} />
              <Text style={[styles.rowLabel, { color: colors.danger || '#EF4444', fontSize: fonts.md }]}>
                {t.friendInfo.block}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={showBlock}
        title={t.friendInfo.block}
        message={t.friendInfo.blockConfirm}
        confirmLabel={t.friendInfo.block}
        cancelLabel={t.common.cancel}
        destructive
        busy={busy}
        onConfirm={confirmBlock}
        onCancel={() => setShowBlock(false)}
        colors={colors}
        fonts={fonts}
      />
      <ConfirmDialog
        visible={showClear}
        title={t.friendInfo.clearChat}
        message={t.friendInfo.clearChatConfirm}
        confirmLabel={t.friendInfo.clearChat}
        cancelLabel={t.common.cancel}
        destructive
        busy={busy}
        onConfirm={confirmClear}
        onCancel={() => setShowClear(false)}
        colors={colors}
        fonts={fonts}
      />
      <ConfirmDialog
        visible={showDelete}
        title={t.friendInfo.deleteChat}
        message={t.friendInfo.deleteChatConfirm}
        confirmLabel={t.friendInfo.deleteChat}
        cancelLabel={t.common.cancel}
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setShowDelete(false)}
        colors={colors}
        fonts={fonts}
      />
    </SafeAreaView>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  colors,
  fonts,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: Record<string, string>;
  fonts: Record<string, number>;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, { backgroundColor: colors.surfaceSecondary || colors.surface }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: fonts.sm, fontWeight: '600', marginTop: 4 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontWeight: '600' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  cachedBanner: { textAlign: 'center', marginBottom: Spacing.sm },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  name: { fontWeight: '700', marginTop: Spacing.md },
  username: { marginTop: 2 },
  status: { marginTop: Spacing.xs },
  bio: { marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.lg },
  meta: { marginTop: Spacing.xs, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.lg, gap: Spacing.md },
  chip: {
    minWidth: 88,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cardTitle: {
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowLabel: { flex: 1, fontWeight: '500' },
});
