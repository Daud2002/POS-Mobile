import { apiClient, ApiError } from '../client';

/**
 * Screens branch on `code`, never on message text: the 409s a store server
 * setup produces read differently but each needs its own handling (the Login
 * screen turns STORE_SERVER_MODE into a "Connect to store server" button).
 */

jest.mock('../../lib/secureStorage', () => ({
  secureStorage: {
    getToken: async () => null,
    setToken: async () => undefined,
    clearToken: async () => undefined,
    getRefreshToken: async () => null,
    setRefreshToken: async () => undefined,
    clearRefreshToken: async () => undefined,
  },
}));

function answer(status: number, body: string) {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body),
    } as Response),
  ) as unknown as typeof fetch;
}

async function failure(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
}

describe('ApiError code', () => {
  it('reads the code of a cloud refusing a staff sign-in', async () => {
    answer(
      409,
      JSON.stringify({
        statusCode: 409,
        code: 'STORE_SERVER_MODE',
        message: 'This shop runs on its store server. Connect to it on the shop Wi-Fi.',
      }),
    );

    const error = await failure(() =>
      apiClient.post('/auth/login', { email: 'w@x.y', password: 'p' }, { anonymous: true }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('STORE_SERVER_MODE');
    expect(error.isStoreServerMode).toBe(true);
    expect(error.message).toBe('This shop runs on its store server. Connect to it on the shop Wi-Fi.');
  });

  it('keeps the other store-server codes apart', async () => {
    answer(409, JSON.stringify({ statusCode: 409, code: 'STORE_SERVER_READ_ONLY', message: 'Read only' }));

    const error = await failure(() => apiClient.post('/orders', {}));

    expect(error.code).toBe('STORE_SERVER_READ_ONLY');
    expect(error.isStoreServerMode).toBe(false);
  });

  it('has no code when the body carries none', async () => {
    answer(400, JSON.stringify({ statusCode: 400, message: ['name should not be empty'] }));
    const validation = await failure(() => apiClient.post('/products', {}));
    expect(validation.code).toBeUndefined();
    expect(validation.message).toBe('name should not be empty');

    answer(502, '<html>Bad gateway</html>');
    const proxy = await failure(() => apiClient.get('/products'));
    expect(proxy.code).toBeUndefined();
    expect(proxy.isStoreServerMode).toBe(false);
  });

  it('ignores a code that is not a string', async () => {
    answer(409, JSON.stringify({ statusCode: 409, code: 42, message: 'Conflict' }));
    const error = await failure(() => apiClient.post('/orders', {}));
    expect(error.code).toBeUndefined();
  });
});
