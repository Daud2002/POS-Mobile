import { chooseServer } from '../policy';

const base = { registered: true, storeServerReachable: false, cloudReachable: false, isOwner: false };

describe('chooseServer', () => {
  it('uses the cloud when no store server is registered, reachable or not', () => {
    expect(chooseServer({ ...base, registered: false })).toBe('cloud');
    expect(chooseServer({ ...base, registered: false, cloudReachable: true, isOwner: true })).toBe('cloud');
  });

  it('prefers a reachable store server for everyone', () => {
    expect(chooseServer({ ...base, storeServerReachable: true })).toBe('store');
    expect(chooseServer({ ...base, storeServerReachable: true, cloudReachable: true, isOwner: true })).toBe(
      'store',
    );
  });

  it('lets an owner fall back to the cloud', () => {
    expect(chooseServer({ ...base, cloudReachable: true, isOwner: true })).toBe('cloud');
  });

  it('never silently moves staff to the cloud, which would refuse them', () => {
    expect(chooseServer({ ...base, cloudReachable: true })).toBe('unreachable');
    expect(chooseServer(base)).toBe('unreachable');
  });

  it('reports unreachable when an owner has neither server', () => {
    expect(chooseServer({ ...base, isOwner: true })).toBe('unreachable');
  });
});
