import type { StoreServerHealth, StoreServerStatus } from './types';

/**
 * Short on purpose: probes run at start-up and on every return to the app, and
 * a server on the same Wi-Fi answers in milliseconds. Anything slower is as
 * good as absent for deciding where to send the next request.
 */
export const PROBE_TIMEOUT_MS = 1500;

/**
 * Why a store server did not answer as one.
 *
 * `untrusted` cannot be told apart from a refused connection: React Native
 * reports a rejected TLS certificate as the same bare TypeError ("Network
 * request failed"). On https it is by far the likelier cause — the server is
 * up, the phone just doesn't have the shop certificate yet — so that's what
 * the connect screen explains.
 */
export type ProbeFailure = 'untrusted' | 'unreachable' | 'timeout' | 'not-store' | 'wrong-store';

export type ProbeResult =
  | { ok: true; baseUrl: string; health: StoreServerHealth }
  | { ok: false; reason: ProbeFailure };

class ProbeError extends Error {
  constructor(readonly reason: ProbeFailure) {
    super(reason);
  }
}

/** GET with a hard timeout, outside apiClient: no token, no refresh, no 20-second wait. */
async function getJson(url: string, timeoutMs: number): Promise<{ ok: boolean; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let ok: boolean;
  let text: string;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    ok = response.ok;
    text = await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new ProbeError('timeout');
    throw new ProbeError(
      error instanceof TypeError && /^https:/i.test(url) ? 'untrusted' : 'unreachable',
    );
  } finally {
    clearTimeout(timer);
  }

  try {
    return { ok, body: text ? JSON.parse(text) : null };
  } catch {
    return { ok, body: null };
  }
}

function asHealth(body: unknown): StoreServerHealth | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Partial<StoreServerHealth>;
  if (raw.app !== 'tapntrade-store') return null;
  // Normalised so a field missing from an older server can't crash the banner.
  return {
    app: 'tapntrade-store',
    mode: 'store',
    serverId: typeof raw.serverId === 'string' ? raw.serverId : null,
    storeId: typeof raw.storeId === 'string' ? raw.storeId : null,
    writable: raw.writable === true,
    caSha256: typeof raw.caSha256 === 'string' ? raw.caSha256 : null,
    cloud: {
      reachable: raw.cloud?.reachable === true,
      lastSyncAt: typeof raw.cloud?.lastSyncAt === 'string' ? raw.cloud.lastSyncAt : null,
    },
  };
}

/**
 * Asks `${baseUrl}/health` whether it is a TapNtrade store server — and, when
 * `storeId` is given, this shop's. Says why not, for the connect screen.
 *
 * The store check is what makes it safe to send a password there: another
 * shop's server on a shared Wi-Fi (a food court) answers just the same.
 */
export async function checkStoreServer(
  baseUrl: string,
  { timeoutMs = PROBE_TIMEOUT_MS, storeId }: { timeoutMs?: number; storeId?: string } = {},
): Promise<ProbeResult> {
  const base = baseUrl.replace(/\/+$/, '');

  let response: { ok: boolean; body: unknown };
  try {
    response = await getJson(`${base}/health`, timeoutMs);
  } catch (error) {
    return { ok: false, reason: error instanceof ProbeError ? error.reason : 'unreachable' };
  }

  const health = response.ok ? asHealth(response.body) : null;
  if (!health) return { ok: false, reason: 'not-store' };
  // A server that doesn't know its store yet is still being set up; only a
  // different store is a definite no.
  if (storeId && health.storeId && health.storeId !== storeId) {
    return { ok: false, reason: 'wrong-store' };
  }
  return { ok: true, baseUrl: base, health };
}

/** The health of the store server at `baseUrl`, or null if it isn't one (or isn't this store's). */
export async function probeStoreServer(
  baseUrl: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
  storeId?: string,
): Promise<StoreServerHealth | null> {
  const result = await checkStoreServer(baseUrl, { timeoutMs, storeId });
  return result.ok ? result.health : null;
}

/**
 * Probes every known address at once and returns the first in `baseUrls`
 * order that answers, so the address that worked last time wins a tie.
 */
export async function findStoreServer(
  baseUrls: string[],
  storeId?: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<{ baseUrl: string; health: StoreServerHealth } | null> {
  const results = await Promise.all(
    baseUrls.map((baseUrl) => checkStoreServer(baseUrl, { timeoutMs, storeId })),
  );
  for (const result of results) {
    if (result.ok) return { baseUrl: result.baseUrl, health: result.health };
  }
  return null;
}

/** Any HTTP answer at all counts: this asks "is the internet there", not "is it healthy". */
export async function isServerReachable(
  baseUrl: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    await getJson(`${baseUrl.replace(/\/+$/, '')}/health`, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

/** `GET /local/status`, or null when the server can't be asked. */
export async function fetchStoreServerStatus(
  baseUrl: string,
  timeoutMs = 4000,
): Promise<StoreServerStatus | null> {
  try {
    const { ok, body } = await getJson(`${baseUrl.replace(/\/+$/, '')}/local/status`, timeoutMs);
    if (!ok || !body || typeof body !== 'object') return null;
    const raw = body as Partial<StoreServerStatus>;
    return {
      paired: raw.paired === true,
      serverId: raw.serverId ?? null,
      storeId: raw.storeId ?? null,
      writable: raw.writable === true,
      cloudReachable: raw.cloudReachable === true,
      lastSyncAt: raw.lastSyncAt ?? null,
      lastSyncError: raw.lastSyncError ?? null,
      pendingChanges: Number(raw.pendingChanges) || 0,
      parked: Number(raw.parked) || 0,
      recentConflicts: Number(raw.recentConflicts) || 0,
      leaseExpired: raw.leaseExpired === true,
    };
  } catch {
    return null;
  }
}
