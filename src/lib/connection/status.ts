import type { ConnectionMode, StoreServerHealth, StoreServerStatus } from './types';

export type ConnectionTone = 'muted' | 'info' | 'warning' | 'danger';

export interface ConnectionLine {
  tone: ConnectionTone;
  text: string;
}

/** "just now", "2 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/**
 * The one line a restaurant screen shows about the store server, or null on
 * the cloud (where there is nothing to say).
 *
 * Ordered by what stops work: unreachable, then the two states in which the
 * server refuses to save orders, then "the cloud is behind" — which is fine
 * for service and only worth a count of what's waiting.
 *
 * `status` (polled every 15s) is preferred over `health` (from the last
 * probe) because it is newer and carries the waiting count.
 */
export function describeConnection({
  mode,
  health,
  status,
  now = Date.now(),
}: {
  mode: ConnectionMode;
  health: StoreServerHealth | null;
  status: StoreServerStatus | null;
  now?: number;
}): ConnectionLine | null {
  if (mode === 'cloud') return null;
  if (mode === 'unreachable') {
    return { tone: 'danger', text: "Can't reach the store server · check the shop Wi-Fi" };
  }

  // Until the first probe or poll lands there is nothing true to report.
  if (!status && !health) return { tone: 'muted', text: 'Store server' };

  // All from one source: mixing them would let an old probe's lastSyncAt
  // stand in for a poll that says the server has never synced.
  const writable = status ? status.writable : health!.writable;
  const cloudReachable = status ? status.cloudReachable : health!.cloud.reachable;
  const lastSyncAt = status ? status.lastSyncAt : health!.cloud.lastSyncAt;
  const waiting = status?.pendingChanges ?? 0;
  const waitingText = waiting > 0 ? ` · ${waiting} waiting` : '';

  if (status?.leaseExpired) {
    return { tone: 'warning', text: 'Store server · offline too long · connect the PC to the internet' };
  }
  if (!writable) {
    return { tone: 'warning', text: 'Store server · not active yet' };
  }
  if (!cloudReachable) {
    return { tone: 'info', text: `Store server · offline from cloud${waitingText}` };
  }
  const ago = timeAgo(lastSyncAt, now);
  return {
    tone: 'muted',
    text: `Store server · ${ago ? `synced ${ago}` : 'not synced yet'}${waitingText}`,
  };
}
