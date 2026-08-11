import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { ActionMenuSheet } from '../../src/components/ActionMenuSheet';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { cacheManager, CacheDomain } from '../../src/cache';
import { Spacing } from '../../src/theme';

interface BlockedUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarId: string;
  avatarUrl?: string | null;
  avatarVersion?: number;
}

export default function BlockedUsersScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getBlockedUsers()
      .then((r) => setBlocked((r as { blocked: BlockedUser[] }).blocked))
      .catch(() => {});
  }, []);

  const finishUnblock = useCallback(
    async (user: BlockedUser, restoreHistory: boolean) => {
      if (busy) return;
      setBusy(true);
      setPendingUnblock(null);
      try {
        const result = await api.unblockUser(user.id, { restoreHistory });
        setBlocked((prev) => prev.filter((u) => u.id !== user.id));
        // Force chat list to reload conversation (restored or empty)
        cacheManager.remove(CacheDomain.CONVERSATIONS);
        if (result.conversationId && !restoreHistory) {
          await cacheManager.clearConversationMessages(result.conversationId);
        }
        Alert.alert(
          '',
          restoreHistory ? t.friends.unblockRestored : t.friends.unblockEmptied
        );
      } catch (err) {
        Alert.alert(
          t.common.error,
          err instanceof Error ? err.message : t.friends.unblockFailed
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, t]
  );

  const unblockMenuItems = useMemo(
    () =>
      pendingUnblock
        ? [
            {
              key: 'restore',
              label: t.friends.unblockRestoreChat,
              onPress: () => {
                void finishUnblock(pendingUnblock, true);
              },
            },
            {
              key: 'empty',
              label: t.friends.unblockEmptyChat,
              destructive: true,
              onPress: () => {
                void finishUnblock(pendingUnblock, false);
              },
            },
          ]
        : [],
    [pendingUnblock, t, finishUnblock]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.lg }]}>
          {t.settings.blockedUsers}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={blocked}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.item, { backgroundColor: colors.surface }]}>
            <Avatar
              userId={item.id}
              avatarId={item.avatarId}
              imageUrl={item.avatarUrl}
              imageVersion={item.avatarVersion}
              size={44}
            />
            <View style={styles.itemContent}>
              <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>@{item.username}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setPendingUnblock(item)}
              disabled={busy}
            >
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: fonts.sm }}>
                {t.friends.unblock}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: colors.textSecondary }}>{t.common.noResults}</Text>
          </View>
        }
      />

      <ActionMenuSheet
        visible={Boolean(pendingUnblock)}
        title={
          pendingUnblock
            ? `${t.friends.unblock} ${pendingUnblock.firstName}?\n${t.friends.unblockHistoryPrompt}`
            : t.friends.unblock
        }
        items={unblockMenuItems}
        onClose={() => {
          if (!busy) setPendingUnblock(null);
        }}
        colors={colors}
        fonts={fonts}
        cancelLabel={t.common.cancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  title: { fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  itemContent: { flex: 1 },
  itemName: { fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
});
