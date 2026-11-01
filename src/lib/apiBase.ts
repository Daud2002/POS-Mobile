import { create } from 'zustand';

import { API_BASE_URL } from '@/constants/config';

interface ApiBaseState {
  /** The API base every request goes to, including the `/api` prefix. */
  baseUrl: string;
  setBaseUrl: (baseUrl: string) => void;
}

/**
 * The build's own server — the cloud in a release build. Where the app goes
 * whenever there is no store server to use, and the one server whose tokens
 * keep the original secure-storage keys.
 */
export const CLOUD_API_BASE_URL: string = API_BASE_URL.replace(/\/+$/, '');

/**
 * Which server the app is talking to.
 *
 * Starts at the cloud. Kept in a store rather than a constant because a phone
 * moves between servers at runtime: inside a shop it should use the store
 * server on the cashier PC, which keeps working when the internet drops, and
 * the cloud everywhere else. Everything that reaches the backend — requests,
 * image URLs, the socket — reads the current value through getApiBaseUrl() at
 * the moment it connects.
 */
export const useApiBase = create<ApiBaseState>((set) => ({
  baseUrl: CLOUD_API_BASE_URL,
  setBaseUrl: (baseUrl) => set({ baseUrl: baseUrl.replace(/\/+$/, '') }),
}));

export const getApiBaseUrl = (): string => useApiBase.getState().baseUrl;

/** The socket gateway is mounted on the server root, not under the /api prefix. */
export const getSocketUrl = (): string => getApiBaseUrl().replace(/\/api\/?$/, '');
