import { apiClient } from '../client';
import { CLOUD_API_BASE_URL, useApiBase } from '../../lib/apiBase';
import { tokenScopeFor } from '../../lib/connection/tokenScope';

/**
 * Sessions are per server: the store server signs its own tokens, so the
 * cloud's and the store server's must never share a keychain slot — a
 * store-server refresh written over the cloud's would sign the user out of
 * the cloud, and the reverse would spend a token the other server never
 * issued.
 */

// Keyed exactly like the real thing: base key + scope suffix.
const mockVault = new Map<string, string>();

jest.mock('../../lib/secureStorage', () => ({
  secureStorage: {
    getToken: async (scope = '') => mockVault.get(`access${scope}`) ?? null,
    setToken: async (token: string, scope = '') => {
      mockVault.set(`access${scope}`, token);
    },
    clearToken: async (scope = '') => {
      mockVault.delete(`access${scope}`);
    },
    getRefreshToken: async (scope = '') => mockVault.get(`refresh${scope}`) ?? null,
    setRefreshToken: async (token: string, scope = '') => {
      mockVault.set(`refresh${scope}`, token);
    },
    clearRefreshToken: async (scope = '') => {
      mockVault.delete(`refresh${scope}`);
    },
  },
}));

const STORE = 'https://192.168.1.20/api';
const storeScope = tokenScopeFor(STORE);

const json = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);

/** Moves the client the way connectionStore.applyServer does: tokens first, then the address. */
async function moveTo(baseUrl: string) {
  await apiClient.hydrate(baseUrl);
  useApiBase.getState().setBaseUrl(baseUrl);
}

beforeEach(async () => {
  mockVault.clear();
  mockVault.set('access', 'cloud-access');
  mockVault.set('refresh', 'cloud-refresh');
  await moveTo(CLOUD_API_BASE_URL);
  apiClient.setUnauthorizedHandler(null);
});

afterAll(() => {
  useApiBase.getState().setBaseUrl(CLOUD_API_BASE_URL);
});

describe('tokenScopeFor', () => {
  it('keeps the cloud on the original keys, so existing installs stay signed in', () => {
    expect(tokenScopeFor(CLOUD_API_BASE_URL)).toBe('');
    expect(tokenScopeFor(`${CLOUD_API_BASE_URL}/`)).toBe('');
  });

  it('gives each other server a short, stable, keychain-safe suffix', () => {
    expect(storeScope).toMatch(/^_[0-9a-f]{8}$/);
    expect(tokenScopeFor('https://192.168.1.20/api/')).toBe(storeScope);
    expect(tokenScopeFor('HTTPS://192.168.1.20/API')).toBe(storeScope);
    expect(tokenScopeFor('https://192.168.1.21/api')).not.toBe(storeScope);
  });
});

describe('apiClient per-server tokens', () => {
  it('loads the session of whichever server it is moved to', async () => {
    mockVault.set(`access${storeScope}`, 'store-access');
    mockVault.set(`refresh${storeScope}`, 'store-refresh');

    expect(apiClient.getToken()).toBe('cloud-access');

    await moveTo(STORE);
    expect(apiClient.getToken()).toBe('store-access');
    expect(apiClient.getRefreshToken()).toBe('store-refresh');

    await moveTo(CLOUD_API_BASE_URL);
    expect(apiClient.getToken()).toBe('cloud-access');
  });

  it('starts signed out on a server this device has never signed in to', async () => {
    await moveTo(STORE);
    expect(apiClient.getToken()).toBeNull();
    expect(apiClient.getRefreshToken()).toBeNull();
  });

  it('files a store-server sign-in under its own keys and leaves the cloud session alone', async () => {
    await moveTo(STORE);
    await apiClient.setToken('store-access');
    await apiClient.setRefreshToken('store-refresh');

    expect(mockVault.get(`access${storeScope}`)).toBe('store-access');
    expect(mockVault.get('access')).toBe('cloud-access');

    await apiClient.clearToken();
    expect(mockVault.has(`access${storeScope}`)).toBe(false);
    expect(mockVault.get('access')).toBe('cloud-access');
    expect(mockVault.get('refresh')).toBe('cloud-refresh');
  });

  it('sends the right token to each server and refreshes against the server it is on', async () => {
    mockVault.set(`access${storeScope}`, 'store-expired');
    mockVault.set(`refresh${storeScope}`, 'store-refresh');
    await moveTo(STORE);

    const seen: Array<{ url: string; auth?: string; body?: string }> = [];
    globalThis.fetch = jest.fn((url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seen.push({ url: String(url), auth: headers.Authorization, body: init?.body as string });
      if (String(url).endsWith('/auth/refresh')) {
        return json(201, { accessToken: 'store-access-2', refreshToken: 'store-refresh-2' });
      }
      return headers.Authorization === 'Bearer store-access-2'
        ? json(200, { ok: true })
        : json(401, { message: 'Unauthorized' });
    }) as unknown as typeof fetch;

    await expect(apiClient.get('/auth/me')).resolves.toMatchObject({ ok: true });

    expect(seen.map((call) => call.url)).toEqual([
      `${STORE}/auth/me`,
      `${STORE}/auth/refresh`,
      `${STORE}/auth/me`,
    ]);
    expect(seen[0].auth).toBe('Bearer store-expired');
    expect(seen[1].body).toContain('store-refresh');
    expect(mockVault.get(`access${storeScope}`)).toBe('store-access-2');
    expect(mockVault.get(`refresh${storeScope}`)).toBe('store-refresh-2');
    // The cloud's pair is untouched.
    expect(mockVault.get('access')).toBe('cloud-access');
    expect(mockVault.get('refresh')).toBe('cloud-refresh');
  });

  /**
   * The phone walks out of the shop while a refresh is in flight. The rotated
   * pair belongs to the store server (whose previous refresh token is now
   * spent) and must not overwrite the cloud session the app just moved to.
   */
  it('files a refresh that finishes after a server switch under the server that issued it', async () => {
    mockVault.set(`access${storeScope}`, 'store-expired');
    mockVault.set(`refresh${storeScope}`, 'store-refresh');
    await moveTo(STORE);

    let finishRefresh: () => void = () => undefined;
    let refreshStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const onUnauthorized = jest.fn();
    apiClient.setUnauthorizedHandler(onUnauthorized);

    globalThis.fetch = jest.fn((url: string) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshStarted();
        return new Promise<Response>((resolve) => {
          finishRefresh = () =>
            resolve(
              json(201, { accessToken: 'store-access-2', refreshToken: 'store-refresh-2' }) as never,
            );
        });
      }
      return json(401, { message: 'Unauthorized' });
    }) as unknown as typeof fetch;

    const pending = apiClient.get('/auth/me');
    await started;
    await moveTo(CLOUD_API_BASE_URL);
    finishRefresh();

    await expect(pending).rejects.toMatchObject({ isNetwork: true });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(mockVault.get(`access${storeScope}`)).toBe('store-access-2');
    expect(mockVault.get(`refresh${storeScope}`)).toBe('store-refresh-2');
    expect(apiClient.getToken()).toBe('cloud-access');
    expect(apiClient.getRefreshToken()).toBe('cloud-refresh');
  });
});
