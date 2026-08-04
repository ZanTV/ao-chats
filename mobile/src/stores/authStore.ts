import { create } from 'zustand';
import { api } from '../services/api';
import {
  saveTokens,
  clearTokens,
  getRefreshToken,
  getAccessToken,
  cacheUser,
  getCachedUser,
} from '../services/storage';
import { socketService } from '../services/socket';
import { ApiError } from '../utils/validation';
import { withTimeout, INIT_TIMEOUT_MS } from '../services/config';

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
  emailVerificationPending: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshProfile: () => Promise<boolean>;
  updateUser: (data: Partial<User>) => void;
  setEmailVerificationPending: (pending: boolean) => void;
  /** @deprecated use initializeAuth or refreshProfile */
  loadUser: () => Promise<boolean>;
}

async function persistUser(user: User) {
  await cacheUser(user);
  return user;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  emailVerificationPending: false,

  setEmailVerificationPending: (pending) => {
    set({ emailVerificationPending: pending });
  },

  login: async (email, password, rememberMe) => {
    try {
      const result = await api.login(email, password, rememberMe) as {
        user: User;
        accessToken: string;
        refreshToken: string;
      };
      await saveTokens(result.accessToken, result.refreshToken);
      await persistUser(result.user);
      await socketService.connect();
      set({ user: result.user, isAuthenticated: true, isLoading: false, emailVerificationPending: false });
    } catch (err) {
      // Check if error is EMAIL_NOT_VERIFIED
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        set({ emailVerificationPending: true, isLoading: false });
        throw err; // Re-throw so the UI can navigate to verification screen
      }
      throw err;
    }
  },

  register: async (data) => {
    await api.register(data);
    set({ emailVerificationPending: true });
  },

  verifyEmail: async (email, code) => {
    try {
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
        set({ user: profile, isAuthenticated: true, isLoading: false, emailVerificationPending: false });
      } catch {
        set({ user: result.user, isAuthenticated: true, isLoading: false, emailVerificationPending: false });
      }
    } catch (err) {
      // Keep emailVerificationPending as true if verification fails
      set({ isLoading: false });
      throw err;
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
    set({ user: null, isAuthenticated: false, isLoading: false, emailVerificationPending: false });
  },

  initializeAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await withTimeout(getAccessToken(), 5000, null).catch(() => null);
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false, emailVerificationPending: false });
        return;
      }

      const cached = await withTimeout(getCachedUser<User>(), 5000, null).catch(() => null);
      if (cached) {
        set({ user: cached, isAuthenticated: true, isLoading: false, emailVerificationPending: false });
        socketService.connect().catch(() => {});
        api.getProfile()
          .then(async (user) => {
            const profile = user as User;
            await persistUser(profile);
            set({ user: profile, isAuthenticated: true, emailVerificationPending: false });
          })
          .catch(async (err) => {
            if (
              err instanceof ApiError &&
              (err.message === 'Session expired' || err.code === 'UNAUTHORIZED')
            ) {
              await clearTokens();
              set({ user: null, isAuthenticated: false, emailVerificationPending: false });
            }
          });
        return;
      }

      const user = await withTimeout(api.getProfile(), INIT_TIMEOUT_MS) as User;
      await persistUser(user);
      socketService.connect().catch(() => {});
      set({ user, isAuthenticated: true, isLoading: false, emailVerificationPending: false });
    } catch (err) {
      const token = await getAccessToken().catch(() => null);
      const cached = await getCachedUser<User>().catch(() => null);
      const isSessionExpired =
        err instanceof ApiError &&
        (err.message === 'Session expired' || err.code === 'UNAUTHORIZED');

      if (isSessionExpired || !token) {
        await clearTokens().catch(() => {});
        set({ user: null, isAuthenticated: false, isLoading: false, emailVerificationPending: false });
      } else if (cached) {
        // Offline / temporary DB issue — keep cached session
        set({ user: cached, isAuthenticated: true, isLoading: false, emailVerificationPending: false });
        socketService.connect().catch(() => {});
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false, emailVerificationPending: false });
      }
    }
  },

  refreshProfile: async () => {
    try {
      const user = await api.getProfile() as User;
      await persistUser(user);
      set({ user, isAuthenticated: true, emailVerificationPending: false });
      return true;
    } catch (err) {
      if (err instanceof ApiError && (err.message === 'Session expired' || err.code === 'UNAUTHORIZED')) {
        await clearTokens().catch(() => {});
        set({ user: null, isAuthenticated: false, emailVerificationPending: false });
        return false;
      }

      const cached = await getCachedUser<User>().catch(() => null);
      if (cached) {
        set({ user: cached, isAuthenticated: true, emailVerificationPending: false });
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
