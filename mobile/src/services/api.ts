import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';
import { getApiUrl } from './config';
import { formatApiError, ApiError } from '../utils/validation';

class ApiClient {
  private baseUrl = getApiUrl();

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
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      throw new ApiError(
        `Cannot reach server at ${this.baseUrl}. Check Wi-Fi and that backend is running.`,
        'NETWORK_ERROR'
      );
    }

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        const newToken = await getAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        const retry = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({ error: 'Request failed' }));
          throw new ApiError(formatApiError(err), err.code);
        }
        return retry.json();
      }
      throw new ApiError('Session expired', 'UNAUTHORIZED');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new ApiError(formatApiError(err), err.code);
    }

    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refresh = await getRefreshToken();
      if (!refresh) return false;

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });

      if (!response.ok) {
        await clearTokens();
        return false;
      }

      const { accessToken } = await response.json();
      await saveTokens(accessToken, refresh);
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

  getUniversities = () => this.request<{ universities: string[] }>('/auth/universities');

  getAvatars = () =>
    this.request<{ categories: Record<string, string[]> }>('/auth/avatars');

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
  getMessages = (conversationId: string, cursor?: string) => {
    const params = cursor ? `?cursor=${cursor}` : '';
    return this.request(`/messages/${conversationId}${params}`);
  };
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

  // Notifications
  getNotifications = () => this.request('/notifications');
  getUnreadCount = () => this.request<{ count: number }>('/notifications/unread-count');
  markNotificationRead = (id: string) =>
    this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  markAllNotificationsRead = () =>
    this.request('/notifications/read-all', { method: 'POST' });
}

export const api = new ApiClient();
