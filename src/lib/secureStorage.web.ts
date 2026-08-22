const AUTH_TOKEN_KEY = 'tapntrade_auth_token';
const REFRESH_TOKEN_KEY = 'tapntrade_refresh_token';

/**
 * Web implementation of token storage.
 *
 * `expo-secure-store` has NO working web build — its `.web.js` is literally
 * `export default {}`, so `setItemAsync` throws a TypeError in a browser.
 * Metro resolves this `.web.ts` ahead of `secureStorage.ts` on web, keeping the
 * native Keychain/Keystore path untouched on Android and iOS.
 *
 * localStorage is not secure storage — but this exists only for the browser
 * preview, and the production web app already keeps its JWT in localStorage
 * under `auth_token`, so the exposure is no worse than what already ships.
 */
export const secureStorage = {
  async getToken(): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(AUTH_TOKEN_KEY) ?? null;
    } catch {
      // Storage can be unavailable in private mode or a sandboxed frame.
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      globalThis.localStorage?.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      // Non-fatal: the session still works in memory for this tab, it just
      // won't survive a refresh.
    }
  },

  async clearToken(): Promise<void> {
    try {
      globalThis.localStorage?.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // Already gone.
    }
  },

  // Must mirror secureStorage.ts — Metro picks this file on web, so a missing
  // method here surfaces as a runtime crash only in the browser preview.
  async getRefreshToken(): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    try {
      globalThis.localStorage?.setItem(REFRESH_TOKEN_KEY, token);
    } catch {
      // Non-fatal, as above.
    }
  },

  async clearRefreshToken(): Promise<void> {
    try {
      globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Already gone.
    }
  },
};
