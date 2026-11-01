import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'tapntrade_auth_token';
const REFRESH_TOKEN_KEY = 'tapntrade_refresh_token';

/**
 * JWT storage.
 *
 * The web app keeps its token in `localStorage['auth_token']` and reads it
 * synchronously inside the ApiClient constructor. SecureStore is async, so the
 * token is hydrated once at boot into an in-memory field on the API client
 * (see src/api/client.ts) rather than being read on every request.
 *
 * Every method takes a `scope`: the key suffix of the server the tokens belong
 * to (lib/connection/tokenScope.ts). The cloud's scope is '', so its keys are
 * the original ones.
 */
export const secureStorage = {
  async getToken(scope = ''): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(AUTH_TOKEN_KEY + scope);
    } catch {
      // A corrupt keychain entry should log the user out, not crash the app.
      return null;
    }
  },

  async setToken(token: string, scope = ''): Promise<void> {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY + scope, token);
  },

  async clearToken(scope = ''): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY + scope);
    } catch {
      // Already absent — nothing to do.
    }
  },

  /**
   * The refresh token outlives the access token by design (7 days vs 30
   * minutes), so it is the credential that actually keeps a user signed in
   * between sessions. Same keychain, same failure handling.
   */
  async getRefreshToken(scope = ''): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY + scope);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string, scope = ''): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY + scope, token);
  },

  async clearRefreshToken(scope = ''): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY + scope);
    } catch {
      // Already absent — nothing to do.
    }
  },
};
