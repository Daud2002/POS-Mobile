import { describeConnection, timeAgo } from '../status';
import type { StoreServerHealth, StoreServerStatus } from '../types';

const now = Date.parse('2026-10-30T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const health: StoreServerHealth = {
  app: 'tapntrade-store',
  mode: 'store',
  serverId: 'srv-1',
  storeId: 'store-1',
  writable: true,
  caSha256: null,
  cloud: { reachable: true, lastSyncAt: minutesAgo(5) },
};

const status: StoreServerStatus = {
  paired: true,
  serverId: 'srv-1',
  storeId: 'store-1',
  writable: true,
  cloudReachable: true,
  lastSyncAt: minutesAgo(2),
  lastSyncError: null,
  pendingChanges: 0,
  parked: 0,
  recentConflicts: 0,
  leaseExpired: false,
};

const line = (overrides: Partial<StoreServerStatus>) =>
  describeConnection({ mode: 'store', health, status: { ...status, ...overrides }, now });

describe('timeAgo', () => {
  it('rounds down to what a person would say', () => {
    expect(timeAgo(minutesAgo(0.5), now)).toBe('just now');
    expect(timeAgo(minutesAgo(2), now)).toBe('2 min ago');
    expect(timeAgo(minutesAgo(125), now)).toBe('2 h ago');
    expect(timeAgo(minutesAgo(60 * 24), now)).toBe('1 day ago');
    expect(timeAgo(minutesAgo(60 * 72), now)).toBe('3 days ago');
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo('not a date', now)).toBeNull();
  });
});

describe('describeConnection', () => {
  it('says nothing on the cloud', () => {
    expect(describeConnection({ mode: 'cloud', health: null, status: null, now })).toBeNull();
  });

  it('warns loudest when the store server is out of reach', () => {
    expect(describeConnection({ mode: 'unreachable', health, status, now })).toMatchObject({
      tone: 'danger',
    });
  });

  it('shows a quiet sync line on a healthy server, with what is waiting', () => {
    expect(line({})).toEqual({ tone: 'muted', text: 'Store server · synced 2 min ago' });
    expect(line({ pendingChanges: 3 })).toEqual({
      tone: 'muted',
      text: 'Store server · synced 2 min ago · 3 waiting',
    });
    expect(line({ lastSyncAt: null })).toEqual({ tone: 'muted', text: 'Store server · not synced yet' });
  });

  it('notes when the shop has lost the internet', () => {
    expect(line({ cloudReachable: false, pendingChanges: 12 })).toEqual({
      tone: 'info',
      text: 'Store server · offline from cloud · 12 waiting',
    });
  });

  it('warns when the server will not take orders', () => {
    expect(line({ writable: false })).toEqual({ tone: 'warning', text: 'Store server · not active yet' });
    expect(line({ leaseExpired: true, cloudReachable: false })).toMatchObject({ tone: 'warning' });
  });

  it('falls back to the last probe before the first status poll lands', () => {
    expect(describeConnection({ mode: 'store', health, status: null, now })).toEqual({
      tone: 'muted',
      text: 'Store server · synced 5 min ago',
    });
    expect(
      describeConnection({ mode: 'store', health: { ...health, writable: false }, status: null, now }),
    ).toMatchObject({ tone: 'warning' });
  });
});
