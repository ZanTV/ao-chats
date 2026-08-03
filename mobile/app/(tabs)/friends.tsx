import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { api } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { Spacing, BorderRadius } from '../../src/theme';

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

interface SearchUser extends Friend {}

export default function FriendsScreen() {
  const { colors, fonts, t } = useSettingsStore();
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.getFriends(),
        api.getPendingRequests(),
      ]);
      setFriends((friendsRes as { friends: Friend[] }).friends);
      setRequests((requestsRes as { requests: FriendRequest[] }).requests);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = socketService.on('friend:request', () => loadData());
    return () => unsub();
  }, [loadData]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const result = await api.searchUsers(q) as { users: SearchUser[] };
      setSearchResults(result.users);
    } catch {
      setSearchResults([]);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      Alert.alert('Success', 'Friend request sent');
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

  const handleStartChat = async (userId: string) => {
    try {
      const conv = await api.getOrCreateConversation(userId) as { id: string };
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : t.common.error);
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity style={[styles.item, { backgroundColor: colors.surface }]} onPress={() => handleStartChat(item.id)}>
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

  const renderRequest = ({ item }: { item: FriendRequest }) => (
    <View style={[styles.item, { backgroundColor: colors.surface }]}>
      <Avatar avatarId={item.sender.avatarId} size={48} />
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]}>
          {item.sender.firstName} {item.sender.lastName}
        </Text>
        <Text style={[styles.itemSub, { color: colors.textSecondary, fontSize: fonts.sm }]}>
          @{item.sender.username}
        </Text>
      </View>
      <View style={styles.requestActions}>
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

  const renderSearchResult = ({ item }: { item: SearchUser }) => {
    const isFriend = friends.some((f) => f.id === item.id);
    return (
      <View style={[styles.item, { backgroundColor: colors.surface }]}>
        <Avatar avatarId={item.avatarId} size={48} />
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, { color: colors.text, fontSize: fonts.md }]}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={[styles.itemSub, { color: colors.textSecondary, fontSize: fonts.sm }]}>
            @{item.username} {item.university ? `· ${item.university}` : ''}
          </Text>
        </View>
        {!isFriend && (
          <Button title={t.friends.addFriend} onPress={() => handleSendRequest(item.id)} size="sm" variant="outline" />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text, fontSize: fonts.title }]}>
        {t.friends.title}
      </Text>

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
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontSize: fonts.md }]}
            placeholder={t.friends.search}
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
        </View>
      )}

      <FlatList
        data={tab === 'friends' ? friends : tab === 'requests' ? requests : searchResults}
        renderItem={tab === 'friends' ? renderFriend : tab === 'requests' ? renderRequest : renderSearchResult}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {tab === 'friends' ? t.friends.noFriends : t.common.noResults}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: '700', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabText: { fontWeight: '600' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, height: 44, gap: Spacing.sm },
  searchInput: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  itemContent: { flex: 1 },
  itemName: { fontWeight: '600' },
  itemSub: {},
  requestActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { marginTop: Spacing.md, fontSize: 16 },
});
