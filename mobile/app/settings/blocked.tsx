import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { Spacing } from '../../src/theme';

interface BlockedUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarId: string;
}

export default function BlockedUsersScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

  useEffect(() => {
    api.getBlockedUsers()
      .then((r) => setBlocked((r as { blocked: BlockedUser[] }).blocked))
      .catch(() => {});
  }, []);

  const handleUnblock = (userId: string) => {
    Alert.alert(t.friends.unblock, undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.friends.unblock,
        onPress: async () => {
          await api.unblockUser(userId);
          setBlocked((prev) => prev.filter((u) => u.id !== userId));
        },
      },
    ]);
  };

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
            <Avatar avatarId={item.avatarId} size={44} />
            <View style={styles.itemContent}>
              <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>@{item.username}</Text>
            </View>
            <TouchableOpacity onPress={() => handleUnblock(item.id)}>
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
