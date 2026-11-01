import type { ConnectionMode } from './types';

export interface ChooseServerInput {
  /** This device knows the shop's store server (lib/connection/registry.ts). */
  registered: boolean;
  storeServerReachable: boolean;
  cloudReachable: boolean;
  isOwner: boolean;
}

/**
 * Which server the app should talk to right now.
 *
 * - A reachable store server always wins: it keeps working when the shop's
 *   internet drops, and once a store is in server mode the cloud refuses
 *   order, table and shift writes anyway.
 * - Owners may fall back to the cloud (from home, say).
 * - Staff may not: the cloud refuses staff sign-ins while the store is in
 *   server mode, so falling back would only trade a clear "can't reach the
 *   store server" for a confusing login error.
 *
 * Without a registered server there is nothing to choose: the cloud, even if
 * it is down right now (the usual offline handling covers that).
 */
export function chooseServer({
  registered,
  storeServerReachable,
  cloudReachable,
  isOwner,
}: ChooseServerInput): ConnectionMode {
  if (!registered) return 'cloud';
  if (storeServerReachable) return 'store';
  if (isOwner && cloudReachable) return 'cloud';
  return 'unreachable';
}
