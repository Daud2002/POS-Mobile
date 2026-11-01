/**
 * Wire shapes of the store-server endpoints. The backend owns them
 * (POS-Backend/src/sync); these mirror it and must not drift.
 */

/** `GET /health` on a store server. The cloud answers `{ app: 'tapntrade-cloud' }` instead. */
export interface StoreServerHealth {
  app: 'tapntrade-store';
  mode: 'store';
  serverId: string | null;
  storeId: string | null;
  /** False until the cloud has made this server the shop's writer: orders can't be saved yet. */
  writable: boolean;
  /** SHA-256 of the shop certificate, for comparing with the phone's installed copy. */
  caSha256: string | null;
  cloud: { reachable: boolean; lastSyncAt: string | null };
}

/** `GET /local/status` on a store server (public). */
export interface StoreServerStatus {
  paired: boolean;
  serverId: string | null;
  storeId: string | null;
  writable: boolean;
  cloudReachable: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  /** Local changes the cloud hasn't received yet. */
  pendingChanges: number;
  parked: number;
  recentConflicts: number;
  /** Offline from the cloud for too long: the server stops taking writes. */
  leaseExpired: boolean;
}

/** `GET /store-servers/discover` on the cloud (any signed-in user). */
export interface StoreServerDiscovery {
  operationMode: 'cloud' | 'server';
  server: {
    id: string;
    /** Server roots such as `https://192.168.1.20` — without the `/api` prefix. */
    lanUrls: string[];
    caSha256: string | null;
    lastSeenAt: string | null;
  } | null;
}

/** The shop's store server this device knows about. One per device. */
export interface RegisteredStoreServer {
  serverId?: string;
  storeId: string;
  /** API base (with `/api`) that answered last; tried first. */
  baseUrl: string;
  /** Every API base the server reported, for when its address changes. */
  lanUrls: string[];
  caSha256?: string;
}

export type ConnectionMode = 'cloud' | 'store' | 'unreachable';
