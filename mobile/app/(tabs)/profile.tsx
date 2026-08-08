import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { ProfileSection, ProfileField } from '../../src/components/ProfileSection';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { formatDate, formatLastSeen } from '../../src/utils/profile';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { NotificationBell } from '../../src/components/NotificationPanel';
import { Spacing, BorderRadius } from '../../src/theme';

export default function ProfileScreen() {
  const { user, refreshProfile, logout } = useAuthStore();
  const { colors, fonts, t } = useSettingsStore();
  const friendStats = useNotificationStore((s) => s.friendStats);
  const refreshFriendStats = useNotificationStore((s) => s.refreshFriendStats);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await refreshProfile();
      if (!ok && !useAuthStore.getState().user) {
        setLoadError(true);
      }
      refreshFriendStats();
    })();
  }, [refreshProfile, refreshFriendStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    setLoadError(false);
    const ok = await refreshProfile();
    await refreshFriendStats();
    if (!ok && !useAuthStore.getState().user) {
      setLoadError(true);
    }
    setRefreshing(false);
  };

  const handleLogout = () => {
    if (loggingOut) return;
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Local session is cleared inside logout.
    } finally {
      setShowLogoutConfirm(false);
      setLoggingOut(false);
      router.replace('/(auth)/login');
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        {loadError ? (
          <>
            <Ionicons name="cloud-offline-outline" size={56} color={colors.textTertiary} />
            <Text style={[styles.errorTitle, { color: colors.text, fontSize: fonts.md }]}>
              {t.common.error}
            </Text>
            <Text style={[styles.errorSub, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              Could not load your profile. Check your connection and try again.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={onRefresh}
            >
              <Text style={styles.retryText}>{t.common.retry}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  const isOnline = user.status === 'ONLINE';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <Avatar
              avatarId={user.avatarId || 'avatar-1'}
              size={110}
              showOnline
              isOnline={isOnline}
              isVerified={user.isVerified}
            />
          </View>
          <Text style={[styles.name, { color: colors.text, fontSize: fonts.xl }]}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={[styles.username, { color: colors.textSecondary, fontSize: fonts.md }]}>
            @{user.username}
          </Text>
          {user.emailVerified && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <Text style={[styles.verifiedText, { color: colors.success, fontSize: fonts.xs }]}>
                {t.profile.verified}
              </Text>
            </View>
          )}
          {user.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {user.bio}
            </Text>
          ) : null}
          {user.statusMessage && (
            <Text style={[styles.statusMsg, { color: colors.primary, fontSize: fonts.sm }]}>
              {user.statusMessage}
            </Text>
          )}
          <Text style={[styles.statusLine, { color: colors.textTertiary, fontSize: fonts.sm }]}>
            {formatLastSeen(user.lastSeen, isOnline)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/profile/edit')}
          >
            <Ionicons name="create-outline" size={20} color="#FFF" />
            <Text style={styles.actionText}>{t.profile.edit}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryAction, { borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>{t.settings.title}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: colors.primary, fontSize: fonts.xl }]}>
              {friendStats.friendCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.xs }]}>
              {t.profile.friendsCount}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/friends')}
          >
            <Text style={[styles.statNumber, { color: colors.warning, fontSize: fonts.xl }]}>
              {friendStats.pendingReceivedCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.xs }]}>
              {t.profile.pendingRequests}
            </Text>
          </TouchableOpacity>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: colors.text, fontSize: fonts.xl }]}>
              {friendStats.pendingSentCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.xs }]}>
              {t.profile.sentRequests}
            </Text>
          </View>
        </View>

        <ProfileSection title={t.profile.personalInfo} colors={colors} fonts={fonts}>
          <ProfileField icon="person-outline" label={t.auth.firstName} value={user.firstName} colors={colors} fonts={fonts} />
          <ProfileField icon="person-outline" label={t.auth.lastName} value={user.lastName} colors={colors} fonts={fonts} />
          <ProfileField icon="at-outline" label={t.auth.username} value={`@${user.username}`} colors={colors} fonts={fonts} />
          <ProfileField icon="document-text-outline" label={t.profile.bio} value={user.bio || '—'} colors={colors} fonts={fonts} />
        </ProfileSection>

        <ProfileSection title={t.profile.education} colors={colors} fonts={fonts}>
          <ProfileField icon="school-outline" label={t.auth.university} value={user.university || '—'} colors={colors} fonts={fonts} />
          <ProfileField icon="book-outline" label={t.auth.course} value={user.course || '—'} colors={colors} fonts={fonts} />
          <TouchableOpacity
            style={[styles.linkRow, { borderTopColor: colors.border }]}
            onPress={() => router.push('/settings/universities' as Href)}
          >
            <Ionicons name="library-outline" size={20} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.primary, fontSize: fonts.sm }]}>
              {t.profile.viewAllUniversities}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </ProfileSection>

        <ProfileSection title={t.profile.privateInfo} colors={colors} fonts={fonts}>
          <ProfileField
            icon="mail-outline"
            label={t.auth.email}
            value={user.email}
            colors={colors}
            fonts={fonts}
            private
            verified={user.emailVerified}
          />
          <ProfileField
            icon="call-outline"
            label={t.profile.mobileNumber}
            value={user.mobileNumber || '—'}
            colors={colors}
            fonts={fonts}
            private
          />
        </ProfileSection>

        <ProfileSection title={t.profile.accountInfo} colors={colors} fonts={fonts}>
          <ProfileField
            icon="calendar-outline"
            label={t.profile.memberSince}
            value={user.createdAt ? formatDate(user.createdAt) : '—'}
            colors={colors}
            fonts={fonts}
          />
        </ProfileSection>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.danger + '15' }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          )}
          <Text style={[styles.logoutText, { color: colors.danger, fontSize: fonts.md }]}>
            {t.settings.logout}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title={t.settings.logout}
        message={t.settings.logoutConfirm}
        confirmLabel={t.settings.logout}
        cancelLabel={t.common.cancel}
        destructive
        busy={loggingOut}
        onConfirm={() => { void confirmLogout(); }}
        onCancel={() => {
          if (!loggingOut) setShowLogoutConfirm(false);
        }}
        colors={colors}
        fonts={fonts}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  avatarWrap: { marginBottom: Spacing.md },
  name: { fontWeight: '700' },
  username: { marginTop: 4 },
  bio: { marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  verifiedText: { fontWeight: '600' },
  statusMsg: { marginTop: Spacing.sm, fontStyle: 'italic', textAlign: 'center' },
  statusLine: { marginTop: Spacing.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statNumber: { fontWeight: '700' },
  statLabel: { marginTop: 4, textAlign: 'center' },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.md,
  },
  actionText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  secondaryAction: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  secondaryActionText: { fontWeight: '600', fontSize: 16 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkText: { flex: 1, fontWeight: '600' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  logoutText: { fontWeight: '600' },
  errorTitle: { marginTop: Spacing.md, fontWeight: '600', textAlign: 'center' },
  errorSub: { marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  retryText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});
