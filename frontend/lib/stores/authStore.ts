/**
 * Authentication Store (Zustand v5)
 */
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { login as apiLogin, refreshToken as apiRefreshToken, TokenPair } from '@/lib/api/auth';

// ---------- Persisted slice type ----------
interface AuthPersisted {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
}

// ---------- Custom PersistStorage (Zustand v5 compatible) ----------
// In v5, storage.setItem receives an OBJECT (StorageValue<S>), NOT a string.
// We handle JSON serialisation ourselves and route to
// localStorage (rememberMe) or sessionStorage (default).
const authPersistStorage: PersistStorage<AuthPersisted> = {
  getItem: (name: string): StorageValue<AuthPersisted> | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(name) || sessionStorage.getItem(name);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StorageValue<AuthPersisted>;
    } catch {
      return null;
    }
  },

  setItem: (name: string, value: StorageValue<AuthPersisted>): void => {
    if (typeof window === 'undefined') return;
    const str = JSON.stringify(value);
    if (value.state?.rememberMe) {
      localStorage.setItem(name, str);
      sessionStorage.removeItem(name);
    } else {
      sessionStorage.setItem(name, str);
      localStorage.removeItem(name);
    }
  },

  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

// ---------- Full store type ----------
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  rememberMe: boolean;

  // Actions
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  clearError: () => void;
  setRememberMe: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      rememberMe: false,

      login: async (username: string, password: string, rememberMe = false) => {
        set({ isLoading: true, error: null, rememberMe });
        try {
          const tokens: TokenPair = await apiLogin({ username, password });
          set({
            accessToken: tokens.access,
            refreshToken: tokens.refresh,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            rememberMe,
          });
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Login failed',
            isAuthenticated: false,
          });
          return false;
        }
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          rememberMe: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          set({ isAuthenticated: false });
          return false;
        }

        try {
          const result = await apiRefreshToken(refreshToken);
          set({ accessToken: result.access });
          return true;
        } catch {
          // Refresh failed, logout
          set({
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      clearError: () => set({ error: null }),
      setRememberMe: (value: boolean) => set({ rememberMe: value }),
    }),
    {
      name: 'auth-storage',
      storage: authPersistStorage,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        rememberMe: state.rememberMe,
      }),
    }
  )
);

/**
 * Get access token for API requests
 */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return useAuthStore.getState().isAuthenticated;
}
