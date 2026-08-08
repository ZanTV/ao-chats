import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { NotificationBell } from '../../src/components/NotificationPanel';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { api } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { cacheManager, CacheDomain } from '../../src/cache';
import { Spacing, BorderRadius } from '../../src/theme';
import { formatConversationTime } from '../../src/utils/conversation';

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarId: string;
  status: string;
  university?: string;
}

interface FriendRequest {
  id: string;
  sender: Friend;
}

interface SentRequest {
  id: string;
  createdAt: string;
  receiver: Friend;
}

type Relationship = 'none' | 'friend' | 'pending_sent' | 'pending_received';

interface SearchUser extends Friend {
  relationship?: Relationship;
}

type FriendListItem = FriendRequest | SentRequest | Friend;

type FriendSection = {
  key: 'pending_received' | 'pending_sent' | 'friends';
  title: string;
  data: readonly FriendListItem[];
};

export default function FriendsScreen() {
  const { colors, fonts, t, language } = useSettingsStore();
  const refreshFriendStats = useNotificationStore((s) => s.refreshFriendStats);
  const friendsFocus = useNotificationStore((s) => s.friendsFocus);
  const setFriendsFocus = useNotificationStore((s) => s.setFriendsFocus);
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set());

  const locale = language === 'sw' ? 'sw-KE' : undefined;

  useEffect(() => {
    if (friendsFocus === 'requests') {
      setTab('friends');
      setFriendsFocus(null);
    }
  }, [friendsFocus, setFriendsFocus]);

  const loadData = useCallback(async () => {
    await cacheManager.loadWithRefresh<Friend[]>(
      CacheDomain.FRIENDS,
      async () => {
        const friendsRes = await api.getFriends() as {
          friends: Friend[];
          cacheVersion?: number;
        };
        return { data: friendsRes.friends || [], cacheVersion: friendsRes.cacheVersion };
      },
      (data) => setFriends(data)
    );

    try {
      const [requestsRes, sentRes] = await Promise.all([
        api.getPendingRequests(),
        api.getSentRequests(),
      ]);
      setRequests((requestsRes as { requests: FriendRequest[] }).requests);
      setSentRequests((sentRes as { requests: SentRequest[] }).requests);
      await refreshFriendStats();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [refreshFriendStats]);

  useEffect(() => {
    loadData();
    const unsubs = [
      socketService.on('friend:request', () => loadData()),
      socketService.on('friend:accepted', () => loadData()),
      socketService.on('friend:request:cancelled', () => loadData()),
    ];
    return () => unsubs.forEach((u) => u());
  }, [loadData]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    cacheManager.addSearchQuery(q);
    try {
      const result = await api.searchUsers(q) as { users: SearchUser[] };
      setSearchResults(result.users);
    } catch {
      setSearchResults([]);
    }
  };

  const getRelationship = (user: SearchUser): Relationship => {
    if (user.relationship) return user.relationship;
    if (pendingUserIds.has(user.id)) return 'pending_sent';
    if (friends.some((f) => f.id === user.id)) return 'friend';
    if (requests.some((r) => r.sender.id === user.id)) return 'pending_received';
    if (sentRequests.some((r) => r.receiver.id === user.id)) return 'pending_sent';
    return 'none';
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      setPendingUserIds((prev) => new Set(prev).add(userId));
      setSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, relationship: 'pending_sent' as const } : u))
      );
      await loadData();
      if (Platform.OS !== 'web') {
        Alert.alert('Success', t.friends.requestSent);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await api.respondToRequest(requestId, accept);
      loadData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleCancelRequest = async (requestId: string, receiverId: string) => {
    try {
      await api.cancelFriendRequest(requestId);
      setPendingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(receiverId);
        return next;
      });
      loadData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleStartChat = async (userId: string) => {
    try {
      const conv = await api.getOrCreateConversation(userId) as { id: string };
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    }
  };

  const friendSections: FriendSection[] = [
    ...(requests.length > 0
      ? [{ key: 'pending_received' as const, title: t.friends.pendingIncoming, data: requests }]
      : []),
    ...(sentRequests.length > 0
      ? [{ key: 'pending_sent' as const, title: t.friends.pendingOutgoing, data: sentRequests }]
      : []),
    { key: 'friends' as const, title: t.friends.yourFriends, data: friends },
  ];

  const renderSearchActions = (item: SearchUser) => {
    const relationship = getRelationship(item);

    if (relationship === 'friend') {
      return (
        <Button title={t.friends.startChat} onPress={() => handleStartChat(item.id)} size="sm" />
      );
    }

    if (relationship === 'pending_sent' || relationship === 'pending_received') {
      return (
        <View style={styles.searchActions}>
          <View style={[styles.pendingPill, { backgroundColor: colors.warning + '20' }]}>
            <Text style={{ color: colors.warning, fontSize: fonts.xs, fontWeight: '600' }}>
              {t.friends.pendingLabel}
            </Text>
          </View>
          <Button
            title={t.friends.startChat}
            onPress={() => handleStartChat(item.id)}
            size="sm"
            variant="outline"
          />
        </View>
      );
    }

    return (
      <Button
        title={t.friends.addFriend}
        onPress={() => handleSendRequest(item.id)}
        size="sm"
        variant="outline"
      />
    );
  };

  const renderFriend = (item: Friend) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handleStartChat(item.id)}
    >
      <Avatar avatarId={item.avatarId} size={48} showOnline isOnline={item.status === 'ONLINE'} />
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={[styles.itemSub, { color: colors.textSecondary, fontSize: fonts.sm }]}>
          @{item.username}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleStartChat(item.id)}>
        <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderPendingReceived = (item: FriendRequest) => (
    <View style={[styles.item, styles.pendingItem, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
      <Avatar avatarId={item.sender.avatarId} size={48} />
      <View style={styles.itemContent}>
        <View style={styles.pendingRow}>
          <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]}>
            {item.sender.firstName} {item.sender.lastName}
          </Text>
          <View style={[styles.pendingPill, { backgroundColor: colors.primary + '15' }]}>
            <Text style={{ color: colors.primary, fontSize: fonts.xs, fontWeight: '600' }}>
              {t.friends.pendingLabel}
            </Text>
          </View>
        </View>
        <Text style={[styles.itemSub, { color: colors.textSecondary, fontSize: fonts.sm }]}>
          @{item.sender.username} · {t.friends.wantsToBeFriend}
        </Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
          onPress={() => handleStartChat(item.sender.id)}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.success + '20' }]}
          onPress={() => handleRespond(item.id, true)}
        >
          <Ionicons name="checkmark" size={20} color={colors.success} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.danger + '20' }]}
          onPress={() => handleRespond(item.id, false)}
        >
          <Ionicons name="close" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPendingSent = (item: SentRequest) => (
    <View style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Avatar avatarId={item.receiver.avatarId} size={48} showOnline isOnline={item.receiver.status === 'ONLINE'} />
      <View style={styles.itemContent}>
        <View style={styles.chatHeaderRow}>
          <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]} numberOfLines={1}>
            {item.receiver.firstName} {item.receiver.lastName}
          </Text>
          <Text style={[styles.itemTime, { color: colors.textTertiary, fontSize: fonts.xs }]}>
            {item.createdAt ? formatConversationTime(item.createdAt, locale) : ''}
          </Text>
        </View>
        <Text style={[styles.itemSub, { color: colors.textSecondary, fontSize: fonts.sm }]} numberOfLines={1}>
          @{item.receiver.username}
        </Text>
        <Text style={[styles.itemSub, { color: colors.textTertiary, fontSize: fonts.sm }]} numberOfLines={1}>
          {t.friends.waitingForResponse}
        </Text>
      </View>
      <View style={styles.sentActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
          onPress={() => handleStartChat(item.receiver.id)}
          accessibilityLabel={t.friends.startChat}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.danger + '20' }]}
          onPress={() => handleCancelRequest(item.id, item.receiver.id)}
          accessibilityLabel={t.friends.cancelRequest}
        >
          <Ionicons name="close" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: SearchUser }) => (
    <View style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Avatar avatarId={item.avatarId} size={48} />
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={[styles.itemSub, { color: colors.textSecondary, fontSize: fonts.sm }]}>
          @{item.username} {item.university ? `· ${item.university}` : ''}
        </Text>
      </View>
      {renderSearchActions(item)}
    </View>
  );

  const renderSectionItem = ({ item, section }: { item: FriendRequest | SentRequest | Friend; section: FriendSection }) => {
    if (section.key === 'pending_received') return renderPendingReceived(item as FriendRequest);
    if (section.key === 'pending_sent') return renderPendingSent(item as SentRequest);
    return renderFriend(item as Friend);
  };

  const friendsEmpty =
    requests.length === 0 && sentRequests.length === 0 && friends.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.title }]}>
          {t.friends.title}
        </Text>
        <NotificationBell />
      </View>

      <View style={styles.tabs}>
        {(['friends', 'requests', 'search'] as const).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.tab, tab === tabKey && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[styles.tabText, { color: tab === tabKey ? colors.primary : colors.textSecondary, fontSize: fonts.sm }]}>
              {tabKey === 'friends' ? t.friends.title : tabKey === 'requests' ? t.friends.pending : t.friends.search}
            </Text>
            {tabKey === 'requests' && requests.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.tabBadgeText}>{requests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'search' && (
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.inputBackground,
              borderColor: searchFocused ? colors.primary : colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            style={[
              styles.searchInput,
              { color: colors.text, fontSize: fonts.md },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
            placeholder={t.friends.search}
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoFocus
          />
        </View>
      )}

      {tab === 'friends' ? (
        <SectionList<FriendListItem, FriendSection>
          sections={friendSections}
          keyExtractor={(item, index) => ('id' in item ? item.id : String(index))}
          renderItem={renderSectionItem}
          renderSectionHeader={({ section }) =>
            section.data.length > 0 ? (
              <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: fonts.sm }]}>
                  {section.title}
                </Text>
                {section.key === 'pending_received' && (
                  <Text style={{ color: colors.textTertiary, fontSize: fonts.xs }}>
                    {section.data.length}
                  </Text>
                )}
              </View>
            ) : null
          }
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            friendsEmpty ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t.friends.noFriends}
                </Text>
                <Button title={t.friends.findFriends} onPress={() => setTab('search')} variant="outline" />
              </View>
            ) : null
          }
          contentContainerStyle={friendsEmpty ? styles.emptyContainer : undefined}
        />
      ) : tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderPendingReceived(item)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t.friends.noPendingRequests}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery.length < 2 ? t.friends.searchHint : t.common.noResults}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  title: { fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabText: { fontWeight: '600' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  pendingItem: { borderWidth: 1.5 },
  itemContent: { flex: 1 },
  chatHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  itemName: { fontWeight: '600', flex: 1 },
  itemTime: { flexShrink: 0 },
  itemSub: { marginTop: 2 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  requestActions: { flexDirection: 'row', gap: Spacing.sm },
  sentActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchActions: { alignItems: 'flex-end', gap: Spacing.xs },
  pendingPill: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyContainer: { flexGrow: 1 },
  emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: Spacing.lg },
});
