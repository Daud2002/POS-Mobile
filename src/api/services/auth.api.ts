import { apiClient } from '../client';
import { AppUser, LoginResponse } from '../types';

export const authApi = {
  /** Anonymous — must not send a stale bearer token. */
  login(email: string, password: string) {
    return apiClient.post<LoginResponse>('/auth/login', { email, password }, { anonymous: true });
  },

  /**
   * Returns the user WITH `storeId`, `currency` and `printerConfig`, which the
   * JWT payload does not carry. Every store-scoped screen depends on this
   * round-trip completing at boot.
   */
  getProfile() {
    return apiClient.get<AppUser>('/auth/me');
  },

  /**
   * Revokes the refresh token and every token rotated from it.
   *
   * Anonymous because the access token may already have expired — the refresh
   * token in the body is what identifies the session. Never throws: signing
   * out locally must not depend on reaching the server.
   */
  async logout(): Promise<void> {
    const refreshToken = apiClient.getRefreshToken();
    if (!refreshToken) return;
    try {
      await apiClient.post<void>('/auth/logout', { refreshToken }, { anonymous: true });
    } catch {
      // Offline sign-out is still a sign-out.
    }
  },

  /**
   * POST /auth/change-password — added to the backend as part of this work; it
   * did not exist before (see plan Part 8).
   */
  changePassword(currentPassword: string, newPassword: string) {
    return apiClient.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },
};
