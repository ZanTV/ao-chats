import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';
import { getApiUrl, API_TIMEOUT_MS } from './config';
import { formatApiError, ApiError } from '../utils/validation';
import { isJwtExpired } from '../utils/jwt';
import { socketService } from './socket';

class ApiClient {
  private get baseUrl() {
    return getApiUrl();
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = API_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(
          'Server is taking too long to respond. Check your connection and try again.',
          'TIMEOUT'
        );
      }
      throw new ApiError(
        'Cannot reach the AO Chats server. Check your internet connection.',
        'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseJsonSafe(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(
        'Could not load or save data from the server. Please try again.',
        'INVALID_RESPONSE'
      );
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        'Cannot reach the AO Chats server. Check your internet connection.',
        'NETWORK_ERROR'
      );
    }

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        const newToken = await getAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        const retry = await this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers,
        });
        if (!retry.ok) {
          const err = await this.parseJsonSafe(retry).catch(() => ({ error: 'Request failed' }));
          throw new ApiError(formatApiError(err as { error?: string }), (err as { code?: string }).code);
        }
        return (await this.parseJsonSafe(retry)) as T;
      }
      throw new ApiError('Session expired', 'UNAUTHORIZED');
    }

    if (!response.ok) {
      const err = await this.parseJsonSafe(response).catch(() => ({
        error: `Request failed (${response.status})`,
      }));
      throw new ApiError(formatApiError(err as { error?: string }), (err as { code?: string }).code);
    }

    return (await this.parseJsonSafe(response)) as T;
  }

  /** Proactively refresh an expired access token before the first API call. */
  async ensureValidSession(): Promise<boolean> {
    const access = await getAccessToken();
    if (!access) return false;
    if (!isJwtExpired(access)) return true;
    return this.refreshToken();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refresh = await getRefreshToken();
      if (!refresh) return false;

      const response = await this.fetchWithTimeout(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      }, 10_000);

      if (!response.ok) {
        await clearTokens();
        return false;
      }

      const data = await this.parseJsonSafe(response);
      const accessToken = String(data.accessToken || '');
      if (!accessToken) {
        await clearTokens();
        return false;
      }
      await saveTokens(accessToken, refresh);
      socketService.reconnect().catch(() => {});
      return true;
    } catch {
      await clearTokens();
      return false;
    }
  }

  // Auth
  register = (data: Record<string, unknown>) =>
    this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });

  verifyEmail = (email: string, code: string) =>
    this.request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) });

  resendVerification = (email: string) =>
    this.request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });

  login = (email: string, password: string, rememberMe?: boolean) =>
    this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });

  logout = (refreshToken: string) =>
    this.request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });

  forgotPassword = (email: string) =>
    this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });

  resetPassword = (email: string, code: string, newPassword: string) =>
    this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    });

  checkUsername = (username: string) =>
    this.request<{ available: boolean }>(`/auth/check-username/${encodeURIComponent(username)}`);

  checkUsernameAvailable = (username: string) =>
    this.request<{ available: boolean }>(`/users/check-username/${encodeURIComponent(username)}`);

  checkPasswordStrength = (password: string) =>
    this.request('/auth/check-password-strength', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });

  getUniversities = () =>
    this.request<{ universities: string[]; cacheVersion?: number }>('/auth/universities');

  getAvatars = () =>
    this.request<{ categories: Record<string, string[]>; cacheVersion?: number }>('/auth/avatars');

  // Users
  getProfile = () => this.request('/users/me');
  updateProfile = (data: Record<string, unknown>) =>
    this.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
  searchUsers = (q: string) => this.request(`/users/search?q=${encodeURIComponent(q)}`);
  getUser = (id: string) => this.request(`/users/${id}`);

  // Friends
  getFriends = () => this.request('/friends');
  getPendingRequests = () => this.request('/friends/requests/pending');
  getSentRequests = () => this.request('/friends/requests/sent');
  sendFriendRequest = (userId: string) =>
    this.request(`/friends/request/${userId}`, { method: 'POST' });
  respondToRequest = (requestId: string, accept: boolean) =>
    this.request(`/friends/request/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ accept }),
    });
  removeFriend = (friendId: string) =>
    this.request(`/friends/${friendId}`, { method: 'DELETE' });
  blockUser = (userId: string) =>
    this.request(`/friends/block/${userId}`, { method: 'POST' });
  unblockUser = (userId: string) =>
    this.request(`/friends/block/${userId}`, { method: 'DELETE' });
  getBlockedUsers = () => this.request('/friends/blocked');

  // Conversations
  getConversations = () => this.request('/conversations');
  getOrCreateConversation = (userId: string) =>
    this.request(`/conversations/direct/${userId}`, { method: 'POST' });
  getOrCreateAoManagerChat = () =>
    this.request<{ id: string; conversation?: { id: string } }>(
      '/conversations/support/ao-manager',
      { method: 'POST', body: '{}' }
    );

  /** Opens AO Manager chat — tries POST, then GET, then existing conversation list */
  openAoManagerChat = async (): Promise<string> => {
    try {
      const res = await this.getOrCreateAoManagerChat();
      if (res?.id) return res.id;
    } catch {
      // fall through
    }

    try {
      const res = await this.request<{ id: string }>('/conversations/support/ao-manager');
      if (res?.id) return res.id;
    } catch {
      // fall through
    }

    const list = await this.getConversations() as {
      conversations: Array<{ id: string; otherUser?: { username?: string } | null }>;
    };
    const existing = list.conversations?.find((c) => c.otherUser?.username === 'ao-manager');
    if (existing?.id) return existing.id;

    throw new ApiError('Could not open AO Manager chat', 'AO_MANAGER_UNAVAILABLE');
  };
  getConversation = (id: string) => this.request(`/conversations/${id}`);
  togglePinConversation = (id: string) =>
    this.request(`/conversations/${id}/pin`, { method: 'PATCH' });
  markConversationRead = (id: string) =>
    this.request(`/conversations/${id}/read`, { method: 'POST' });

  // Messages
  getMessages = (conversationId: string, cursor?: string, limit = 30) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));
    const qs = params.toString();
    return this.request<{
      messages: Record<string, unknown>[];
      nextCursor?: string | null;
      hasMore?: boolean;
      cacheVersion?: number;
    }>(`/messages/${conversationId}?${qs}`);
  };
  getMessagesAround = (conversationId: string, messageId: string, limit = 50) =>
    this.request<{ messages: Record<string, unknown>[] }>(
      `/messages/${conversationId}/around/${messageId}?limit=${limit}`
    );
  sendMessage = (conversationId: string, content: string, replyToId?: string, tempId?: string) =>
    this.request<{ message: Record<string, unknown> }>(`/messages/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId, tempId }),
    }).then((res) => res.message);
  searchMessages = (conversationId: string, q: string) =>
    this.request(`/messages/${conversationId}/search?q=${encodeURIComponent(q)}`);
  reactToMessage = (messageId: string, emoji: string) =>
    this.request(`/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  deleteMessage = (messageId: string, forEveryone: boolean) =>
    this.request(`/messages/${messageId}?forEveryone=${forEveryone}`, { method: 'DELETE' });
  pinMessage = (conversationId: string, messageId: string) =>
    this.request(`/messages/${conversationId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
  unpinMessage = (conversationId: string, messageId: string) =>
    this.request(`/messages/${conversationId}/pin/${messageId}`, { method: 'DELETE' });
  getPinnedMessages = (conversationId: string) =>
    this.request(`/messages/${conversationId}/pins`);

  forwardMessage = (messageId: string, targetConversationId: string) =>
    this.request(`/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ conversationId: targetConversationId }),
    });

  starMessage = (messageId: string) =>
    this.request(`/messages/${messageId}/star`, { method: 'POST' });

  unstarMessage = (messageId: string) =>
    this.request(`/messages/${messageId}/star`, { method: 'DELETE' });

  getStarredMessages = () => this.request('/messages/starred');

  getFriendStats = () =>
    this.request<{ friendCount: number; pendingReceivedCount: number; pendingSentCount: number }>(
      '/friends/stats'
    );

  // Notifications
  getNotificationSummary = () =>
    this.request<{ notifications: unknown[]; unreadCount: number }>('/notifications/summary');
  getNotifications = () => this.request('/notifications');
  getUnreadCount = () => this.request<{ count: number }>('/notifications/unread-count');
  markNotificationRead = (id: string) =>
    this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  markAllNotificationsRead = () =>
    this.request('/notifications/read-all', { method: 'POST' });
  deleteNotification = (id: string) =>
    this.request(`/notifications/${id}`, { method: 'DELETE' });

  registerPushToken = (token: string, platform: string) =>
    this.request('/users/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });

  unregisterPushToken = (token: string) =>
    this.request('/users/push-token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
}

export const api = new ApiClient();
