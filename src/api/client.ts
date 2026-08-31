import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '@/constants/config';
import { secureStorage } from '@/lib/secureStorage';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skips the Authorization header — used by login/register. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

type UnauthorizedHandler = () => void;

/**
 * Thin fetch wrapper over the NestJS API.
 *
 * Differences from the web app's ApiClient (Frontend/src/lib/apiClient.ts):
 *  1. The token lives in expo-secure-store, hydrated once at boot into an
 *     in-memory field, because SecureStore is async and the web version reads
 *     localStorage synchronously on every call.
 *  2. 401 responses invoke a handler so the app can clear the session and
 *     return to Login. The web app has no 401 handling at all — an expired
 *     token just produces a generic error toast.
 *  3. Every call goes through `request()`. The web version hand-rolls fetch in
 *     four places, which is why some callers defensively unwrap `.data`.
 */
class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized: UnauthorizedHandler | null = null;

  /**
   * In-flight refresh shared by all callers. Several screens fire queries in
   * parallel, so without this each would refresh independently: the first
   * rotates the token and the rest replay a spent one, which the server reads
   * as token theft and answers by revoking the entire session.
   */
  private refreshInFlight: Promise<string | null> | null = null;

  /** Loads the persisted tokens. Must be awaited once before the first request. */
  async hydrate(): Promise<string | null> {
    this.token = await secureStorage.getToken();
    this.refreshToken = await secureStorage.getRefreshToken();
    return this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    await secureStorage.setToken(token);
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  async setRefreshToken(token: string): Promise<void> {
    this.refreshToken = token;
    await secureStorage.setRefreshToken(token);
  }

  async clearToken(): Promise<void> {
    this.token = null;
    this.refreshToken = null;
    await secureStorage.clearToken();
    await secureStorage.clearRefreshToken();
  }

  /**
   * Registered by AuthProvider. Now fires only when the session is genuinely
   * unrecoverable — a bare 401 is handled by refreshing and retrying.
   */
  setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
    this.onUnauthorized = handler;
  }

  /** Exchanges the refresh token for a new pair. Null means "session is over". */
  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshInFlight) {
      // Cleanup goes on the OUTER promise via .finally(), not inside
      // performRefresh(). A `finally` in the async body can run synchronously
      // when the body returns before its first await, clearing this field
      // *before* the assignment below lands — the assignment would then store
      // an already-settled promise that every later refresh short-circuits to,
      // permanently breaking renewal. .finally() always runs a microtask later.
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }

    return this.refreshInFlight;
  }

  private async performRefresh(): Promise<string | null> {
    if (!this.refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return null;

      const payload = safeParse(await response.text()) as {
        accessToken?: string;
        refreshToken?: string;
      } | null;

      if (!payload?.accessToken) return null;

      await this.setToken(payload.accessToken);
      // The server rotates on every refresh, so the previous one is dead.
      if (payload.refreshToken) await this.setRefreshToken(payload.refreshToken);

      return payload.accessToken;
    } catch {
      // Offline: keep the session and let the caller surface a network error.
      return null;
    }
  }

  async request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const { method = 'GET', body, anonymous = false, signal } = options;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!anonymous && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    // A hung request should surface as an error rather than an endless spinner.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    signal?.addEventListener('abort', () => controller.abort());

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ApiError('The request timed out. Check your connection.', 0);
      }
      throw new ApiError('Could not reach the server. Check your connection.', 0);
    } finally {
      clearTimeout(timeout);
    }

    // 204 and empty bodies are valid (e.g. DELETE).
    const text = await response.text();
    const payload = text ? safeParse(text) : null;

    if (!response.ok) {
      // Access tokens are deliberately short-lived, so a 401 is the normal way
      // a long session renews itself rather than a sign the user is signed
      // out. Refresh once, replay, and only give up if the refresh fails.
      if (response.status === 401 && !isRetry && !anonymous) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.request<T>(path, options, true);
        }
        this.onUnauthorized?.();
      }
      throw new ApiError(extractMessage(payload) ?? 'Request failed', response.status);
    }

    // NestJS returns bare objects here — there is no global response
    // interceptor — so `?? payload` is the branch that actually runs. The
    // `.data` unwrap is kept for parity with the documented envelope.
    const record = payload as Record<string, unknown> | null;
    if (record && typeof record === 'object' && 'data' in record) {
      return record.data as T;
    }
    return payload as T;
  }

  get<T>(path: string, signal?: AbortSignal) {
    return this.request<T>(path, { method: 'GET', signal });
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** NestJS puts validation failures in `message`, which may be a string or array. */
function extractMessage(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return null;

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.length > 0) return String(message[0]);
  return null;
}

/** Builds a query string, skipping undefined values. */
export function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '';
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `?${search}`;
}

export const apiClient = new ApiClient();

/**
 * Absolute URL for a server-relative upload path (`/uploads/logo/x.png`).
 *
 * The store row holds a relative path on purpose — the API's public origin
 * differs between a dev machine, an Android emulator (10.0.2.2) and
 * production, so it cannot be baked in at upload time. The static mount lives
 * UNDER the '/api' prefix, so the base URL is joined as-is rather than stripped.
 */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
