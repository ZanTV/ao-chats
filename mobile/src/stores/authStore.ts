import { create } from 'zustand';
import { api } from '../services/api';
import {
  saveTokens,
  clearTokens,
  getRefreshToken,
  getAccessToken,
  cacheUser,
  getCachedUser,
  clearCache,
} from '../services/storage';
import { socketService } from '../services/socket';
import { ApiError } from '../utils/validation';
import { INIT_TIMEOUT_MS, withTimeout } from '../services/config';
import { isJwtExpired } from '../utils/jwt';
export interface User {
  id: string;
  email: string;
  emailVerified?: boolean;
  mobileNumber?: string | null;
  username: string;
  firstName: string;
  lastName: string;
  avatarId?: string;
  university?: string;
  course?: string;
  bio?: string;
  status?: string;
  statusMessage?: string;
  lastSeen?: string;
  createdAt?: string;
  isVerified?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshProfile: () => Promise<boolean>;
  updateUser: (data: Partial<User>) => void;
  /** @deprecated use initializeAuth or refreshProfile */
  loadUser: () => Promise<boolean>;
}

async function persistUser(user: User & { cacheVersion?: number }) {
  const { cacheVersion: _v, ...profile } = user;
  await cacheUser(profile);
  return profile;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password, rememberMe) => {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await api.login(normalizedEmail, password, rememberMe) as {
      user: User;
      accessToken: string;
      refreshToken: string;
    };
    await saveTokens(result.accessToken, result.refreshToken);
    await persistUser(result.user);
    await socketService.connect();
    set({ user: result.user, isAuthenticated: true, isLoading: false });
  },

  register: async (data) => {
    await api.register(data);
  },

  verifyEmail: async (email, code) => {
    const result = await api.verifyEmail(email, code) as {
      user: User;
      accessToken: string;
      refreshToken: string;
    };
    await saveTokens(result.accessToken, result.refreshToken);
    await persistUser(result.user);
    await socketService.connect();
    try {
      const profile = await api.getProfile() as User;
      await persistUser(profile);
      set({ user: profile, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: result.user, isAuthenticated: true, isLoading: false });
    }
  },

  logout: async () => {
    try {
      const refresh = await getRefreshToken();
      if (refresh) await api.logout(refresh);
    } catch {
      // ignore
    }
    socketService.disconnect();
    await clearTokens();
    await clearCache().catch(() => {});
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  initializeAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const cached = await getCachedUser<User>().catch(() => null);
      if (cached) {
        set({ user: cached, isAuthenticated: true, isLoading: false });
        socketService.connect().catch(() => {});
        api.ensureValidSession()
          .then(() => api.getProfile())
          .then(async (user) => {
            await persistUser(user as User);
            set({ user: user as User, isAuthenticated: true });
          })
          .catch(async (err) => {
            if (
              err instanceof ApiError &&
              (err.message === 'Session expired' || err.code === 'UNAUTHORIZED')
            ) {
              await clearTokens();
              set({ user: null, isAuthenticated: false });
            }
          });
        return;
      }

      if (isJwtExpired(token)) {
        const refreshed = await api.ensureValidSession();
        if (!refreshed) {
          const refresh = await getRefreshToken();
          const cachedAfterFail = await getCachedUser<User>().catch(() => null);
          if (cachedAfterFail && refresh) {
            set({ user: cachedAfterFail, isAuthenticated: true, isLoading: false });
            socketService.connect().catch(() => {});
            return;
          }
          if (!refresh) {
            await clearTokens();
          }
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
      }

      const user = await withTimeout(api.getProfile(), INIT_TIMEOUT_MS) as User;
      await persistUser(user);
      socketService.connect().catch(() => {});
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {      const token = await getAccessToken().catch(() => null);
      const cached = await getCachedUser<User>().catch(() => null);
      const isSessionExpired =
        err instanceof ApiError &&
        (err.message === 'Session expired' || err.code === 'UNAUTHORIZED');

      if (isSessionExpired || !token) {
        await clearTokens().catch(() => {});
        set({ user: null, isAuthenticated: false, isLoading: false });
      } else if (cached) {
        // Offline / temporary API issue — keep cached session
        set({ user: cached, isAuthenticated: true, isLoading: false });
        socketService.connect().catch(() => {});
      } else if (
        err instanceof ApiError &&
        err.code &&
        ['NETWORK_ERROR', 'SERVER_UNAVAILABLE', 'TIMEOUT'].includes(err.code)
      ) {
        set({ user: null, isAuthenticated: false, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    }
  },

  refreshProfile: async () => {
    try {
      const user = await api.getProfile() as User;
      await persistUser(user);
      set({ user, isAuthenticated: true });
      return true;
    } catch (err) {
      if (err instanceof ApiError && (err.message === 'Session expired' || err.code === 'UNAUTHORIZED')) {
        await clearTokens().catch(() => {});
        set({ user: null, isAuthenticated: false });
        return false;
      }

      const cached = await getCachedUser<User>().catch(() => null);
      if (cached) {
        set({ user: cached, isAuthenticated: true });
        return true;
      }
      return false;
    }
  },

  loadUser: async () => {
    return get().refreshProfile();
  },

  updateUser: (data) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...data };
      cacheUser(updated);
      set({ user: updated });
    }
  },
}));
