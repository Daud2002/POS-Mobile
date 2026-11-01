import { create } from 'zustand';

import { apiClient } from '@/api/client';
import { storeServersApi } from '@/api/services/storeServers.api';
import type { AppUser } from '@/api/types';
import { isOwner } from '@/lib/access';
import { CLOUD_API_BASE_URL, getApiBaseUrl, useApiBase } from '@/lib/apiBase';
import { disconnectSocket } from '@/lib/socket';
import { storage, StorageKey } from '@/lib/storage';

import { chooseServer } from './policy';
import { fetchStoreServerStatus, findStoreServer, isServerReachable } from './probe';
import { toStoreApiBase } from './qr';
import {
  candidateUrls,
  clearRegisteredServer,
  getRegisteredServer,
  isServerAddress,
  saveRegisteredServer,
} from './registry';
import { normalizeBaseUrl } from './tokenScope';
import type {
  ConnectionMode,
  RegisteredStoreServer,
  StoreServerDiscovery,
  StoreServerHealth,
  StoreServerStatus,
} from './types';

interface ConnectionState {
  /**
   * `store`: talking to the shop's store server. `cloud`: no store server, or
   * an owner away from the shop. `unreachable`: this device belongs on a
   * store server it cannot reach right now.
   */
  mode: ConnectionMode;
  /** Mirrors the MMKV registry so screens re-render when it changes. */
  registered: RegisteredStoreServer | null;
  /** From the last successful probe. */
  storeHealth: StoreServerHealth | null;
  /** From the 15-second `/local/status` poll; null until the first one lands. */
  localStatus: StoreServerStatus | null;
  /** Epoch ms of the last probe or poll that reached a verdict. */
  lastChecked: number | null;
  applyServer: (baseUrl: string) => Promise<void>;
}

let switching: Promise<void> = Promise.resolve();

/** Runs `task` after any server switch already under way, and before the next. */
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = switching.then(task);
  switching = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Points the whole app at another server.
 *
 * Order matters. The new server's tokens are loaded first, so no request
 * pairs its address with the old server's token (that is a 401, and the
 * refresh after it would spend the other server's refresh token). Then the
 * socket is dropped, because it is authenticated against the old server.
 * The base URL changes last; AuthProvider and useRealtime react to that.
 *
 * Calls are queued: two overlapping switches could otherwise leave the
 * tokens of one server next to the address of the other.
 */
function applyServer(baseUrl: string): Promise<void> {
  return serialized(async () => {
    const next = baseUrl.replace(/\/+$/, '');
    if (normalizeBaseUrl(next) === normalizeBaseUrl(getApiBaseUrl())) return;
    await apiClient.hydrate(next);
    disconnectSocket();
    useApiBase.getState().setBaseUrl(next);
  });
}

export const useConnectionStore = create<ConnectionState>(() => ({
  mode: 'cloud',
  registered: getRegisteredServer(),
  storeHealth: null,
  localStatus: null,
  lastChecked: null,
  applyServer,
}));

const set = useConnectionStore.setState;

/**
 * Bumped by anything that changes the registry, so an evaluation that started
 * before a person paired or forgot a server doesn't land on top of it.
 */
let registryVersion = 0;

/** Two misses in a row (~30s) before saying unreachable: one dropped poll is usually the Wi-Fi blinking. */
const STATUS_MISSES_BEFORE_UNREACHABLE = 2;
let statusMisses = 0;

/** Owner or not decides the fallback; the cached profile survives a restart with no server to ask. */
function cachedUserIsOwner(): boolean {
  return isOwner(storage.getObject<AppUser>(StorageKey.authProfile));
}

async function runEvaluation(): Promise<ConnectionMode> {
  const version = registryVersion;
  const registered = getRegisteredServer();

  if (!registered) {
    await applyServer(CLOUD_API_BASE_URL);
    set({ mode: 'cloud', registered: null, storeHealth: null, localStatus: null, lastChecked: Date.now() });
    return 'cloud';
  }

  const owner = cachedUserIsOwner();
  // Side by side, so an owner at home waits for one timeout at start-up, not two.
  const [found, cloudReachable] = await Promise.all([
    findStoreServer(candidateUrls(registered), registered.storeId),
    owner ? isServerReachable(CLOUD_API_BASE_URL) : Promise.resolve(false),
  ]);
  if (version !== registryVersion) return useConnectionStore.getState().mode;

  const mode = chooseServer({
    registered: true,
    storeServerReachable: !!found,
    cloudReachable,
    isOwner: owner,
  });

  if (mode === 'store' && found) {
    // Remember the address that answered — and any new id or fingerprint —
    // so the next start tries it first.
    const updated = saveRegisteredServer({
      ...registered,
      baseUrl: found.baseUrl,
      serverId: found.health.serverId ?? registered.serverId,
      caSha256: found.health.caSha256 ?? registered.caSha256,
    });
    await applyServer(found.baseUrl);
    statusMisses = 0;
    set({ mode, registered: updated, storeHealth: found.health, lastChecked: Date.now() });
  } else if (mode === 'cloud') {
    await applyServer(CLOUD_API_BASE_URL);
    set({ mode, registered, storeHealth: null, localStatus: null, lastChecked: Date.now() });
  } else {
    // Stay on the store server's address: staff have nowhere else to go, and
    // requests there fail fast with a clear banner instead of being refused
    // by the cloud with a confusing one.
    const current = getApiBaseUrl();
    await applyServer(isServerAddress(registered, current) ? current : registered.baseUrl);
    set({ mode, registered, lastChecked: Date.now() });
  }
  return mode;
}

let evaluating: Promise<ConnectionMode> | null = null;

/**
 * Probes the registered store server (and, for owners, the cloud) and moves
 * the app to whichever `chooseServer` picks. Single-flight: start-up,
 * foregrounding and the retry timer can all ask at once.
 */
export function evaluateConnection(): Promise<ConnectionMode> {
  if (!evaluating) {
    evaluating = runEvaluation()
      .catch(() => useConnectionStore.getState().mode)
      .finally(() => {
        evaluating = null;
      });
  }
  return evaluating;
}

let initial: Promise<ConnectionMode> | null = null;

/**
 * The start-up decision, with the chosen server's tokens loaded into
 * apiClient. AuthProvider awaits this instead of hydrating on its own, so a
 * staff phone opens straight onto the store server rather than first asking
 * the cloud, which would refuse it. Instant on a device with no store server;
 * otherwise one probe round (1.5s at most, under the splash animation).
 */
export function ensureInitialConnection(): Promise<ConnectionMode> {
  if (!initial) {
    initial = evaluateConnection().then(async (mode) => {
      // applyServer loads tokens only when it actually switches, and at
      // start-up the app is often already on the right server. Queued like a
      // switch, so one arriving meanwhile can't be overwritten with these.
      await serialized(() => apiClient.hydrate());
      return mode;
    });
  }
  return initial;
}

/** Polls `/local/status` on the current store server, for the banner's "synced 2 min ago". */
export async function refreshLocalStatus(): Promise<void> {
  const base = getApiBaseUrl();
  if (!isServerAddress(useConnectionStore.getState().registered, base)) return;

  const status = await fetchStoreServerStatus(base);
  // The app may have moved on while this was in flight.
  if (getApiBaseUrl() !== base || useConnectionStore.getState().mode === 'cloud') return;

  if (status) {
    statusMisses = 0;
    set({ mode: 'store', localStatus: status, lastChecked: Date.now() });
  } else {
    statusMisses += 1;
    if (statusMisses >= STATUS_MISSES_BEFORE_UNREACHABLE) {
      set({ mode: 'unreachable', lastChecked: Date.now() });
    }
  }
}

/** Saves a store server a person just checked (connect screen or the owner offer) and moves to it. */
export async function connectToStoreServer(
  server: RegisteredStoreServer,
  health: StoreServerHealth | null,
): Promise<void> {
  registryVersion += 1;
  const entry = saveRegisteredServer(server);
  set({ registered: entry, storeHealth: health, localStatus: null });
  await applyServer(entry.baseUrl);
  statusMisses = 0;
  set({ mode: 'store', lastChecked: Date.now() });
  void refreshLocalStatus();
}

/** Back to the cloud for good: the phone stops looking for a store server. */
export async function forgetStoreServer(): Promise<void> {
  registryVersion += 1;
  clearRegisteredServer();
  set({ registered: null, storeHealth: null, localStatus: null });
  await applyServer(CLOUD_API_BASE_URL);
  set({ mode: 'cloud', lastChecked: Date.now() });
}

export interface DiscoveredStoreServer {
  server: RegisteredStoreServer;
  health: StoreServerHealth;
}

/**
 * For an owner signed in on the cloud: asks the cloud whether the store runs
 * on a store server, saves its shop-network addresses, and probes them.
 * Returns the server only if it answers from here (the owner is in the shop).
 *
 * Saving even when it doesn't answer is deliberate: the next time the app
 * starts in the shop, the usual start-up probe finds it.
 */
export async function discoverStoreServer(storeId: string): Promise<DiscoveredStoreServer | null> {
  let discovery: StoreServerDiscovery;
  try {
    discovery = await storeServersApi.discover();
  } catch {
    // Offline, or a cloud that predates store servers. Nothing to offer.
    return null;
  }

  const registered = getRegisteredServer();
  if (discovery.operationMode !== 'server' || !discovery.server) {
    // The store went back to the cloud; stop probing its old server at every start.
    if (discovery.operationMode === 'cloud' && registered?.storeId === storeId) {
      await forgetStoreServer();
    }
    return null;
  }

  const lanUrls = discovery.server.lanUrls
    .map(toStoreApiBase)
    .filter((url): url is string => !!url);
  if (lanUrls.length === 0) return null;

  const keepBase =
    registered?.storeId === storeId &&
    lanUrls.some((url) => normalizeBaseUrl(url) === normalizeBaseUrl(registered.baseUrl));

  registryVersion += 1;
  const entry = saveRegisteredServer({
    serverId: discovery.server.id,
    storeId,
    baseUrl: keepBase && registered ? registered.baseUrl : lanUrls[0],
    lanUrls,
    caSha256: discovery.server.caSha256 ?? undefined,
  });
  set({ registered: entry });

  const found = await findStoreServer(candidateUrls(entry), storeId);
  return found ? { server: { ...entry, baseUrl: found.baseUrl }, health: found.health } : null;
}
