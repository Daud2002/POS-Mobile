import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { apiClient, ApiError } from '@/api/client';
import { authApi } from '@/api/services';
import { AppUser } from '@/api/types';
import { useApiBase } from '@/lib/apiBase';
import { ensureInitialConnection } from '@/lib/connection/connectionStore';
import { storage, StorageKey } from '@/lib/storage';

interface AuthContextValue {
  user: AppUser | null;
  /** True until the boot-time token hydration + /auth/me round-trip completes. */
  loading: boolean;
  isAuthenticated: boolean;
  /**
   * `code` is the server's reason when it gave one — 'STORE_SERVER_MODE'
   * means the cloud refused a staff sign-in and the phone should connect to
   * the shop's store server instead.
   */
  login: (email: string, password: string) => Promise<{ error?: string; code?: string }>;
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

  /** Bumped per restore, so a slow /auth/me from the previous server can't land after a newer one. */
  const restoreAttempt = useRef(0);
  const booted = useRef(false);

  /**
   * Opens the session this device holds on the CURRENT server, using the
   * tokens apiClient already loaded for it.
   *
   * The /auth/me round-trip is not optional — `storeId` is NOT in the JWT
   * payload (which is only `{ email, sub, role }`); the backend grafts it on
   * in getUserWithStore(). No store-scoped screen can render without it.
   */
  const restoreSession = useCallback(async () => {
    const attempt = ++restoreAttempt.current;
    const stale = () => attempt !== restoreAttempt.current;

    if (!apiClient.getToken()) {
      // Sessions are per server: none here means sign in here, even if the
      // device is signed in on another one.
      if (!stale()) setUser(null);
      return;
    }

    try {
      const profile = await authApi.getProfile();
      if (!stale()) adopt(profile);
    } catch (error) {
      if (stale()) return;
      if (error instanceof ApiError && (error.isNetwork || error.status >= 500)) {
        // Unreachable is not signed out: keep the tokens, open on the last
        // known profile, and let the next request find the server again. A
        // 5xx counts too — a store server mid-update is failing, not saying
        // the session is over (the refresh path reads it the same way).
        const cached = storage.getObject<AppUser>(StorageKey.authProfile);
        if (cached) setUser(cached);
        return;
      }
      // Expired or revoked token — drop it and show Login.
      storage.remove(StorageKey.authProfile);
      await apiClient.clearToken();
      setUser(null);
    }
  }, [adopt]);

  /**
   * Boot: settle which server to use (and load its tokens), then restore the
   * session there. The server comes first because a staff phone in a shop
   * running on a store server must never ask the cloud, which refuses staff.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureInitialConnection();
        if (cancelled) return;
        // Set before restoring, so a server switch from here on runs its own
        // restore, which supersedes this one.
        booted.current = true;
        await restoreSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  // The app moved between the cloud and the store server. connectionStore
  // has already loaded that server's tokens; open (or ask for) its session.
  useEffect(
    () =>
      useApiBase.subscribe((state, previous) => {
        if (booted.current && state.baseUrl !== previous.baseUrl) void restoreSession();
      }),
    [restoreSession],
  );

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
        return { error: error.message, code: error.code };
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
