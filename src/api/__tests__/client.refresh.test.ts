import { apiClient } from '../client';

/**
 * Covers the refresh path that keeps a shift-long session alive.
 *
 * The single-flight guard is the delicate part: the server rotates the refresh
 * token on every use and treats a replay as theft by revoking the session, so
 * a burst of parallel 401s must collapse into exactly one refresh.
 */

jest.mock('../../lib/secureStorage', () => {
  let access: string | null = null;
  let refresh: string | null = null;
  return {
    secureStorage: {
      getToken: async () => access,
      setToken: async (t: string) => {
        access = t;
      },
      clearToken: async () => {
        access = null;
      },
      getRefreshToken: async () => refresh,
      setRefreshToken: async (t: string) => {
        refresh = t;
      },
      clearRefreshToken: async () => {
        refresh = null;
      },
    },
  };
});

const json = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);

/** 401s every protected call until a refresh happens, then 200s. */
function installServer({ refreshSucceeds = true } = {}) {
  let refreshed = false;
  let refreshCount = 0;

  globalThis.fetch = jest.fn((url: string) => {
    if (String(url).includes('/auth/refresh')) {
      refreshCount++;
      if (!refreshSucceeds) return json(401, { message: 'Invalid refresh token' });
      refreshed = true;
      return json(201, { accessToken: 'new-access', refreshToken: 'refresh-2' });
    }
    if (!refreshed) return json(401, { message: 'Unauthorized' });
    return json(200, { ok: true });
  }) as unknown as typeof fetch;

  return { refreshCount: () => refreshCount };
}

beforeEach(async () => {
  await apiClient.setToken('expired-access');
  await apiClient.setRefreshToken('refresh-1');
  apiClient.setUnauthorizedHandler(null);
});

describe('apiClient refresh', () => {
  it('refreshes once on 401 and replays the request', async () => {
    const server = installServer();

    await expect(apiClient.get('/auth/me')).resolves.toMatchObject({ ok: true });

    expect(server.refreshCount()).toBe(1);
    expect(apiClient.getToken()).toBe('new-access');
    // Keeping the spent token would look like theft on the next refresh.
    expect(apiClient.getRefreshToken()).toBe('refresh-2');
  });

  it('collapses concurrent 401s into a single refresh', async () => {
    const server = installServer();

    const results = await Promise.all([
      apiClient.get('/products'),
      apiClient.get('/categories'),
      apiClient.get('/orders'),
      apiClient.get('/customers'),
      apiClient.get('/auth/me'),
    ]);

    expect(results).toHaveLength(5);
    expect(server.refreshCount()).toBe(1);
  });

  it('signs the user out only when the refresh itself fails', async () => {
    installServer({ refreshSucceeds: false });
    const onUnauthorized = jest.fn();
    apiClient.setUnauthorizedHandler(onUnauthorized);

    await expect(apiClient.get('/auth/me')).rejects.toThrow();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  /**
   * Regression guard. Clearing the in-flight marker inside the async body ran
   * synchronously on this path and was immediately overwritten by the pending
   * assignment, leaving a settled promise cached forever — after which no
   * refresh could ever run again, even once a valid token was stored.
   */
  it('still refreshes after an attempt made with no stored refresh token', async () => {
    await apiClient.clearToken();
    installServer();
    await expect(apiClient.get('/auth/me')).rejects.toThrow();

    // A fresh sign-in, then a normal expiry.
    await apiClient.setToken('expired-access');
    await apiClient.setRefreshToken('refresh-1');
    const server = installServer();

    await expect(apiClient.get('/auth/me')).resolves.toMatchObject({ ok: true });
    expect(server.refreshCount()).toBe(1);
  });
});
