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
  private onUnauthorized: UnauthorizedHandler | null = null;

  /** Loads the persisted token. Must be awaited once before the first request. */
  async hydrate(): Promise<string | null> {
    this.token = await secureStorage.getToken();
    return this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    await secureStorage.setToken(token);
  }

  async clearToken(): Promise<void> {
    this.token = null;
    await secureStorage.clearToken();
  }

  /** Registered by AuthProvider so a 401 anywhere logs the user out. */
  setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
    this.onUnauthorized = handler;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
      if (response.status === 401) {
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
