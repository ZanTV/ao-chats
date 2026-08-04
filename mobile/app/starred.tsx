import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useAuthStore } from '../src/stores/authStore';
import { api } from '../src/services/api';
import { socketService } from '../src/services/socket';
import { normalizeMessage, ChatMessage } from '../src/utils/messages';
import { Spacing, BorderRadius } from '../src/theme';

interface StarEntry {
  id: string;
  messageId: string;
  conversationId: string;
  createdAt: string;
  message: ChatMessage;
  senderName?: string;
}

type SortMode = 'newest' | 'oldest';

export default function StarredScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const { user } = useAuthStore();
  const [stars, setStars] = useState<StarEntry[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [loading, setLoading] = useState(true);

  const loadStars = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getStarredMessages() as { stars: StarEntry[] };
      setStars(
        (res.stars || []).map((s) => {
          const raw = s.message as unknown as Record<string, unknown>;
          const sender = raw.sender as { firstName?: string } | undefined;
          return {
            ...s,
            message: normalizeMessage(raw),
            senderName: sender?.firstName,
          };
        })
      );
    } catch {
      // keep list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStars();
    const unsub = socketService.on('message:star', (data: unknown) => {
      const payload = data as { userId: string; starred: boolean; messageId: string };
      if (payload.userId !== user?.id) return;
      if (!payload.starred) {
        setStars((prev) => prev.filter((s) => s.messageId !== payload.messageId));
      } else {
        loadStars();
      }
    });
    return () => unsub();
  }, [loadStars, user?.id]);

  const filtered = useMemo(() => {
    let list = [...stars];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.message.content.toLowerCase().includes(q) ||
          s.message.senderId.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === 'newest' ? tb - ta : ta - tb;
    });
    return list;
  }, [stars, search, sort]);

  const handleUnstar = (entry: StarEntry) => {
    socketService.unstarMessage(entry.messageId, entry.conversationId);
    setStars((prev) => prev.filter((s) => s.id !== entry.id));
  };

  const jumpToMessage = (entry: StarEntry) => {
    router.push(`/chat/${entry.conversationId}?highlight=${entry.messageId}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.lg }]}>
          {t.chat.starredMessages}
        </Text>
        <TouchableOpacity onPress={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}>
          <Ionicons name="swap-vertical" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.inputBackground }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text, fontSize: fonts.md }]}
          placeholder={t.chat.searchStarred}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => jumpToMessage(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.starBadge, { backgroundColor: colors.warning + '22' }]}>
                <Ionicons name="star" size={16} color={colors.warning} />
              </View>
              <View style={styles.cardBody}>
                <Text style={{ color: colors.text, fontSize: fonts.sm }} numberOfLines={3}>
                  {item.message.deletedForAll ? t.chat.deletedMessage : item.message.content}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, marginTop: 4 }}>
                  {item.senderName || 'Message'}
                  {' · '}
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleUnstar(item)} hitSlop={12}>
                <Ionicons name="star" size={20} color={colors.warning} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl }}>
              {t.chat.noStarred}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.sm },
  list: { padding: Spacing.md, paddingTop: 0 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  starBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
});
