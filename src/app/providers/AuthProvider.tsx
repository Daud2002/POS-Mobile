import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { apiClient, ApiError } from '@/api/client';
import { authApi } from '@/api/services';
import { AppUser } from '@/api/types';
import { storage, StorageKey } from '@/lib/storage';

interface AuthContextValue {
  user: AppUser | null;
  /** True until the boot-time token hydration + /auth/me round-trip completes. */
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  /** Re-fetches /auth/me, e.g. after the store's currency changes. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Shows `profile` and remembers it for a start-up with no server to ask. */
  const adopt = useCallback((profile: AppUser) => {
    storage.setObject(StorageKey.authProfile, profile);
    setUser(profile);
  }, []);

  const clearSession = useCallback(async () => {
    setUser(null);
    storage.remove(StorageKey.authProfile);
    await apiClient.clearToken();
  }, []);

  // Fires only once a refresh has already failed — the client renews and
  // replays an expired access token before ever reaching this, so a routine
  // 401 no longer drops the user back to Login mid-shift.
  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      void clearSession();
    });
    return () => apiClient.setUnauthorizedHandler(null);
  }, [clearSession]);

  /**
   * Boot: hydrate the stored token, then complete the /auth/me round-trip.
   *
   * This round-trip is not optional — `storeId` is NOT in the JWT payload
   * (which is only `{ email, sub, role }`); the backend grafts it on in
   * getUserWithStore(). No store-scoped screen can render without it.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await apiClient.hydrate();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const profile = await authApi.getProfile();
        if (!cancelled) adopt(profile);
      } catch (error) {
        if (error instanceof ApiError && error.isNetwork) {
          // Unreachable is not signed out: keep the tokens, open on the last
          // known profile, and let the next request find the server again.
          const cached = storage.getObject<AppUser>(StorageKey.authProfile);
          if (!cancelled && cached) setUser(cached);
          return;
        }
        // Expired or revoked token — drop it and show Login.
        storage.remove(StorageKey.authProfile);
        await apiClient.clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adopt]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { accessToken, refreshToken, user: loggedIn } = await authApi.login(email, password);
      await apiClient.setToken(accessToken);
      // Without persisting this the session would end when the 30-minute
      // access token lapses, rather than lasting the full 7 days.
      if (refreshToken) await apiClient.setRefreshToken(refreshToken);
      // The login response already carries storeId/currency/printerConfig, so
      // no second /auth/me call is needed here.
      adopt(loggedIn);
      return {};
    } catch (error) {
      if (error instanceof ApiError) {
        return { error: error.message };
      }

      // Anything that is not an ApiError means the request succeeded and
      // something after it failed — token persistence, most likely. Surface it
      // in dev, because the generic message below hides the real cause.
      if (__DEV__) console.error('[auth] login failed after request:', error);
      return { error: 'Unable to sign in. Please try again.' };
    }
  }, [adopt]);

  const logout = useCallback(async () => {
    // Revoke server-side first so the refresh token cannot outlive the
    // session, then clear locally regardless of whether that call succeeded.
    await authApi.logout();
    await clearSession();
  }, [clearSession]);

  const refresh = useCallback(async () => {
    if (!apiClient.getToken()) return;
    try {
      adopt(await authApi.getProfile());
    } catch {
      // The 401 handler already clears the session if the token is dead.
    }
  }, [adopt]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      refresh,
    }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
