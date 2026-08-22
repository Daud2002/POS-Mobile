import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'tapntrade_auth_token';

/**
 * JWT storage.
 *
 * The web app keeps its token in `localStorage['auth_token']` and reads it
 * synchronously inside the ApiClient constructor. SecureStore is async, so the
 * token is hydrated once at boot into an in-memory field on the API client
 * (see src/api/client.ts) rather than being read on every request.
 */
export const secureStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    } catch {
      // A corrupt keychain entry should log the user out, not crash the app.
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  },

  async clearToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    } catch {
      // Already absent — nothing to do.
    }
  },
};
