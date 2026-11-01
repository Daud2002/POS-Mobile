import {
  checkStoreServer,
  fetchStoreServerStatus,
  findStoreServer,
  isServerReachable,
  probeStoreServer,
} from '../probe';

const STORE = 'store-1';

const storeHealth = {
  app: 'tapntrade-store',
  mode: 'store',
  serverId: 'srv-1',
  storeId: STORE,
  writable: true,
  caSha256: 'ab'.repeat(32),
  cloud: { reachable: true, lastSyncAt: '2026-10-30T10:00:00.000Z' },
};

const reply = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response);

/** Answers per URL; anything unlisted fails like an unreachable host. */
function installFetch(routes: Record<string, () => Promise<Response>>) {
  const calls: string[] = [];
  globalThis.fetch = jest.fn((url: string) => {
    calls.push(String(url));
    const route = routes[String(url)];
    return route ? route() : Promise.reject(new TypeError('Network request failed'));
  }) as unknown as typeof fetch;
  return calls;
}

describe('probeStoreServer', () => {
  it('returns the health of a store server, from /health under the API base', async () => {
    const calls = installFetch({ 'https://192.168.1.20/api/health': () => reply(200, storeHealth) });

    await expect(probeStoreServer('https://192.168.1.20/api/')).resolves.toMatchObject({
      app: 'tapntrade-store',
      serverId: 'srv-1',
      writable: true,
    });
    expect(calls).toEqual(['https://192.168.1.20/api/health']);
  });

  it('says no to the cloud and to anything else that answers', async () => {
    installFetch({
      'https://cloud/api/health': () => reply(200, { app: 'tapntrade-cloud', mode: 'cloud' }),
      'https://router/api/health': () => reply(200, '<html>login</html>'),
      'https://missing/api/health': () => reply(404, { message: 'Not Found' }),
    });

    await expect(probeStoreServer('https://cloud/api')).resolves.toBeNull();
    await expect(probeStoreServer('https://router/api')).resolves.toBeNull();
    await expect(probeStoreServer('https://missing/api')).resolves.toBeNull();
  });

  it("refuses another shop's server", async () => {
    installFetch({ 'https://192.168.1.20/api/health': () => reply(200, storeHealth) });

    await expect(probeStoreServer('https://192.168.1.20/api', 1500, 'other-store')).resolves.toBeNull();
    await expect(probeStoreServer('https://192.168.1.20/api', 1500, STORE)).resolves.not.toBeNull();
  });

  it('fills in fields an older server leaves out', async () => {
    installFetch({ 'https://192.168.1.20/api/health': () => reply(200, { app: 'tapntrade-store' }) });

    await expect(probeStoreServer('https://192.168.1.20/api')).resolves.toEqual({
      app: 'tapntrade-store',
      mode: 'store',
      serverId: null,
      storeId: null,
      writable: false,
      caSha256: null,
      cloud: { reachable: false, lastSyncAt: null },
    });
  });
});

describe('checkStoreServer', () => {
  it('blames the certificate when HTTPS fails outright', async () => {
    installFetch({});
    await expect(checkStoreServer('https://192.168.1.20/api')).resolves.toEqual({
      ok: false,
      reason: 'untrusted',
    });
    await expect(checkStoreServer('http://192.168.1.20/api')).resolves.toEqual({
      ok: false,
      reason: 'unreachable',
    });
  });

  it('gives up after the timeout', async () => {
    globalThis.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    ) as unknown as typeof fetch;

    await expect(checkStoreServer('https://10.0.0.9/api', { timeoutMs: 20 })).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    });
  });

  it('names a different store as such', async () => {
    installFetch({ 'https://192.168.1.20/api/health': () => reply(200, storeHealth) });
    await expect(checkStoreServer('https://192.168.1.20/api', { storeId: 'other' })).resolves.toEqual({
      ok: false,
      reason: 'wrong-store',
    });
  });

  it('accepts a server that does not know its store yet', async () => {
    installFetch({
      'https://192.168.1.20/api/health': () => reply(200, { ...storeHealth, storeId: null }),
    });
    await expect(checkStoreServer('https://192.168.1.20/api', { storeId: STORE })).resolves.toMatchObject({
      ok: true,
      baseUrl: 'https://192.168.1.20/api',
    });
  });
});

describe('findStoreServer', () => {
  it('returns the first address in order that answers', async () => {
    installFetch({
      'https://192.168.1.21/api/health': () => reply(200, storeHealth),
      'https://192.168.1.22/api/health': () => reply(200, storeHealth),
    });

    const found = await findStoreServer(
      ['https://192.168.1.20/api', 'https://192.168.1.21/api', 'https://192.168.1.22/api'],
      STORE,
    );
    expect(found?.baseUrl).toBe('https://192.168.1.21/api');
  });

  it('returns null when none answers', async () => {
    installFetch({});
    await expect(findStoreServer(['https://192.168.1.20/api'], STORE)).resolves.toBeNull();
  });
});

describe('isServerReachable', () => {
  it('counts any HTTP answer, and only a failure to connect as unreachable', async () => {
    installFetch({ 'https://cloud/api/health': () => reply(503, 'down for maintenance') });
    await expect(isServerReachable('https://cloud/api')).resolves.toBe(true);
    await expect(isServerReachable('https://elsewhere/api')).resolves.toBe(false);
  });
});

describe('fetchStoreServerStatus', () => {
  it('reads /local/status with sensible defaults', async () => {
    installFetch({
      'https://192.168.1.20/api/local/status': () =>
        reply(200, { paired: true, writable: true, cloudReachable: false, pendingChanges: '7' }),
    });

    await expect(fetchStoreServerStatus('https://192.168.1.20/api')).resolves.toMatchObject({
      paired: true,
      writable: true,
      cloudReachable: false,
      pendingChanges: 7,
      leaseExpired: false,
      lastSyncAt: null,
    });
  });

  it('returns null when the server cannot be asked', async () => {
    installFetch({});
    await expect(fetchStoreServerStatus('https://192.168.1.20/api')).resolves.toBeNull();
  });
});
