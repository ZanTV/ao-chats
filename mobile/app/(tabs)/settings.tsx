import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { Avatar } from '../../src/components/Avatar';
import { ThemeMode, FontSizeMode, Language } from '../../src/theme';
import { Spacing, BorderRadius } from '../../src/theme';
import { api } from '../../src/services/api';

export default function SettingsScreen() {
  const { logout } = useAuthStore();
  const { colors, fonts, t, theme, fontSize, language, setTheme, setFontSize, setLanguage } = useSettingsStore();
  const { unreadCount, setPanelOpen } = useNotificationStore();
  const [openingSupport, setOpeningSupport] = useState(false);

  const handleAoManagerChat = async () => {
    try {
      setOpeningSupport(true);
      const conversationId = await api.openAoManagerChat();
      router.push(`/chat/${conversationId}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t.settings.aoManagerUnavailable;
      Alert.alert(t.common.error, message);
    } finally {
      setOpeningSupport(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t.settings.logout, t.settings.logoutConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.logout,
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.title }]}>
          {t.settings.title}
        </Text>

        <Section title={t.settings.theme} colors={colors} fonts={fonts}>
          <OptionRow
            label={t.settings.light}
            selected={theme === 'light'}
            onPress={() => setTheme('light' as ThemeMode)}
            colors={colors}
          />
          <OptionRow
            label={t.settings.dark}
            selected={theme === 'dark'}
            onPress={() => setTheme('dark' as ThemeMode)}
            colors={colors}
          />
        </Section>

        <Section title={t.settings.language} colors={colors} fonts={fonts}>
          <OptionRow
            label={t.settings.english}
            selected={language === 'en'}
            onPress={() => setLanguage('en' as Language)}
            colors={colors}
          />
          <OptionRow
            label={t.settings.swahili}
            selected={language === 'sw'}
            onPress={() => setLanguage('sw' as Language)}
            colors={colors}
          />
        </Section>

        <Section title={t.settings.fontSize} colors={colors} fonts={fonts}>
          {(['small', 'medium', 'large'] as FontSizeMode[]).map((size) => (
            <OptionRow
              key={size}
              label={t.settings[size]}
              selected={fontSize === size}
              onPress={() => setFontSize(size)}
              colors={colors}
            />
          ))}
        </Section>

        <Section title={t.settings.notifications} colors={colors} fonts={fonts}>
          <TouchableOpacity
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => setPanelOpen(true)}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text, fontSize: fonts.md }]}>
              {t.notifications.title}
            </Text>
            {unreadCount > 0 ? (
              <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        </Section>

        <Section title={t.settings.support} colors={colors} fonts={fonts}>
          <TouchableOpacity
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={handleAoManagerChat}
            disabled={openingSupport}
          >
            <Avatar avatarId="avatar-30" size={40} isVerified showOnline isOnline />
            <View style={styles.supportText}>
              <View style={styles.supportTitleRow}>
                <Text style={[styles.linkText, { color: colors.text, fontSize: fonts.md }]}>
                  {t.settings.aoManager}
                </Text>
                <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
              </View>
              <Text style={[styles.supportSubtitle, { color: colors.textSecondary, fontSize: fonts.sm }]}>
                {t.settings.aoManagerDesc}
              </Text>
            </View>
            {openingSupport ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        </Section>

        <Section title={t.settings.privacy} colors={colors} fonts={fonts}>
          <TouchableOpacity
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/settings/blocked')}
          >
            <Ionicons name="ban-outline" size={22} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text, fontSize: fonts.md }]}>
              {t.settings.blockedUsers}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </Section>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.danger + '15' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger, fontSize: fonts.md }]}>
            {t.settings.logout}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textTertiary }]}>
          AO Chats v2.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, colors, fonts }: {
  title: string;
  children: React.ReactNode;
  colors: Record<string, string>;
  fonts: Record<string, number>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: fonts.sm }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function OptionRow({ label, selected, onPress, colors }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: Record<string, string>;
}) {
  return (
    <TouchableOpacity style={[styles.optionRow, { borderBottomColor: colors.border }]} onPress={onPress}>
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontWeight: '700', marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontWeight: '600', marginBottom: Spacing.sm, letterSpacing: 0.5 },
  sectionContent: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { fontSize: 16 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkText: { flex: 1, fontWeight: '500' },
  notifBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notifBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  supportText: { flex: 1 },
  supportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  supportSubtitle: { marginTop: 2 },
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
  version: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 13 },
});
