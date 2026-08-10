import { create } from 'zustand';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { cacheManager, CacheDomain } from '../cache';
import { updateAppBadge } from '../services/pushService';
import { triggerFeedback } from '../services/feedbackService';
import { getActiveConversation } from '../services/activeConversation';

export interface AppNotification {
  id: string;
  type: 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'NEW_MESSAGE' | 'MENTION';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  actorId?: string | null;
  data?: {
    requestId?: string;
    conversationId?: string;
  } | null;
  actor?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarId: string;
    avatarUrl?: string | null;
    avatarVersion?: number;
  } | null;
}

interface FriendStats {
  friendCount: number;
  pendingReceivedCount: number;
  pendingSentCount: number;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  friendStats: FriendStats;
  panelOpen: boolean;
  loading: boolean;
  friendsFocus: 'friends' | 'requests' | null;
  setPanelOpen: (open: boolean) => void;
  setFriendsFocus: (focus: 'friends' | 'requests' | null) => void;
  refresh: () => Promise<void>;
  refreshFriendStats: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  markConversationNotificationsRead: (conversationId: string, count?: number) => void;
  initialize: () => () => void;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let statsTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(fn: () => void, delay = 400) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(fn, delay);
}

function scheduleStatsRefresh(fn: () => void, delay = 600) {
  if (statsTimer) clearTimeout(statsTimer);
  statsTimer = setTimeout(fn, delay);
}

function syncBadge(unreadCount: number) {
  updateAppBadge(unreadCount).catch(() => {});
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  friendStats: { friendCount: 0, pendingReceivedCount: 0, pendingSentCount: 0 },
  panelOpen: false,
  loading: false,
  friendsFocus: null,

  setPanelOpen: (open) => set({ panelOpen: open }),
  setFriendsFocus: (focus) => set({ friendsFocus: focus }),

  refresh: async () => {
    set({ loading: true });
    await cacheManager.loadWithRefresh<{
      notifications: AppNotification[];
      unreadCount: number;
    }>(
      CacheDomain.NOTIFICATIONS,
      async () => {
        const summary = await api.getNotificationSummary() as {
          notifications: AppNotification[];
          unreadCount: number;
          cacheVersion?: number;
        };
        return {
          data: {
            notifications: summary.notifications,
            unreadCount: summary.unreadCount,
          },
          cacheVersion: summary.cacheVersion,
        };
      },
      (data) => {
        set({
          notifications: data.notifications,
          unreadCount: data.unreadCount,
        });
        syncBadge(data.unreadCount);
      }
    );
    set({ loading: false });
  },

  refreshFriendStats: async () => {
    try {
      const stats = await api.getFriendStats() as FriendStats;
      set({ friendStats: stats });
    } catch {
      // ignore
    }
  },

  markRead: async (id) => {
    const existing = get().notifications.find((n) => n.id === id);
    if (existing?.isRead) return;

    await api.markNotificationRead(id);
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      const unreadCount =
        target && !target.isRead
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount;
      syncBadge(unreadCount);
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount,
      };
    });
  },

  markAllRead: async () => {
    await api.markAllNotificationsRead();
    syncBadge(0);
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (id) => {
    await api.deleteNotification(id);
    set((state) => {
      const removed = state.notifications.find((n) => n.id === id);
      const unreadCount =
        removed && !removed.isRead
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount;
      syncBadge(unreadCount);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount,
      };
    });
  },

  markConversationNotificationsRead: (conversationId, count = 0) => {
    set((state) => {
      let cleared = 0;
      const notifications = state.notifications.map((n) => {
        if (
          !n.isRead &&
          n.type === 'NEW_MESSAGE' &&
          n.data?.conversationId === conversationId
        ) {
          cleared += 1;
          return { ...n, isRead: true };
        }
        return n;
      });
      if (cleared === 0 && count <= 0) {
        return state;
      }
      const decrement = count > 0 ? Math.min(count, state.unreadCount) : cleared;
      const unreadCount = Math.max(0, state.unreadCount - decrement);
      syncBadge(unreadCount);
      return {
        notifications,
        unreadCount,
      };
    });
    // Reconcile with server so badge stays accurate across devices
    scheduleRefresh(() => get().refresh());
  },

  initialize: () => {
    get().refresh();
    get().refreshFriendStats();

    const bumpUnread = (payload?: { conversationId?: string }) => {
      const active = getActiveConversation();
      if (payload?.conversationId && active === payload.conversationId) {
        return;
      }
      set((state) => {
        const unreadCount = state.unreadCount + 1;
        syncBadge(unreadCount);
        return { unreadCount };
      });
      triggerFeedback('notification').catch(() => {});
      scheduleRefresh(() => get().refresh());
    };

    const unsubs = [
      socketService.on('notification:new', (data: unknown) => {
        const payload = data as { conversationId?: string };
        bumpUnread(payload);
        scheduleStatsRefresh(() => get().refreshFriendStats());
      }),
      socketService.on('friend:request', () => {
        scheduleStatsRefresh(() => get().refreshFriendStats());
      }),
      socketService.on('friend:accepted', () => {
        scheduleStatsRefresh(() => get().refreshFriendStats());
      }),
      socketService.on('notification:read', (data: unknown) => {
        const payload = data as { conversationId?: string; count?: number };
        if (payload.conversationId) {
          get().markConversationNotificationsRead(payload.conversationId, payload.count);
        } else {
          scheduleRefresh(() => get().refresh());
        }
      }),
    ];

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (statsTimer) clearTimeout(statsTimer);
      unsubs.forEach((u) => u());
    };
  },
}));
