import Constants from 'expo-constants';

/**
 * Base URL of the NestJS API, including its `/api` global prefix.
 *
 * Mirrors the web app's `VITE_API_URL || 'http://localhost:3000/api'` fallback.
 * On Android emulators `localhost` points at the emulator itself, so the
 * default there is the host loopback alias 10.0.2.2.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://10.0.2.2:3000/api';

/** Requests that exceed this are aborted so the UI never hangs indefinitely. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Stock threshold for the "low stock" warning.
 *
 * The web app hardcodes `stock < 10` on every screen even though products carry
 * a `lowStockAlertQuantity` column (default 5). Mobile prefers the per-product
 * value and only falls back to this constant when it is missing.
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
