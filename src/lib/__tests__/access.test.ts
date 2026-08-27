import { basePermissionFor, can, isOwner, permissionsOf } from '../access';
import type { AppUser } from '@/api/types';

const user = (over: Partial<AppUser>): AppUser =>
  ({ id: '1', name: 'T', email: 't@x.com', role: 'employee', isActive: true, ...over }) as AppUser;

describe('permissionsOf', () => {
  it('prefers the server-provided set', () => {
    expect(permissionsOf(user({ permissions: ['cashier', 'expenses'] }))).toEqual([
      'cashier',
      'expenses',
    ]);
  });

  /**
   * A store build lags the API by a release, so an app in a user's hands can
   * be talking to a backend that predates permissions. Everyone must still
   * land somewhere.
   */
  describe('fallback when the server sent none', () => {
    it('gives owners every module their account type has', () => {
      expect(permissionsOf(user({ role: 'store_owner', effectiveRole: 'store_owner' }))).toContain(
        'pos',
      );
      expect(
        permissionsOf(user({ role: 'store_owner', effectiveRole: 'restaurant_owner' })),
      ).toContain('tables');
    });

    it('gives staff their base module only', () => {
      expect(permissionsOf(user({ accountType: 'restaurant', designation: 'kitchen' }))).toEqual([
        'kitchen',
      ]);
      expect(permissionsOf(user({ accountType: 'restaurant', designation: 'waiter' }))).toEqual([
        'tables',
      ]);
      expect(permissionsOf(user({ accountType: 'general', designation: 'Manager' }))).toEqual([
        'pos',
      ]);
    });
  });

  it('is safe on a null user', () => {
    expect(permissionsOf(null)).toEqual(['pos']);
  });
});

describe('basePermissionFor', () => {
  it('matches the server rules', () => {
    expect(basePermissionFor('restaurant', 'cashier')).toBe('cashier');
    expect(basePermissionFor('restaurant', 'kitchen')).toBe('kitchen');
    expect(basePermissionFor('restaurant', 'waiter')).toBe('tables');
    expect(basePermissionFor('general', 'anything')).toBe('pos');
  });

  /**
   * `designation` is free text, so an unknown value must not lock anyone out.
   * It degrades to CASHIER, matching effectiveRoleOf's own fallback — the two
   * must agree, or a user would bounce between their home screen and a
   * permission check forever.
   */
  it('degrades to cashier for an unrecognised restaurant designation', () => {
    expect(basePermissionFor('restaurant', 'Bartender')).toBe('cashier');
  });

  it('lets every staff member open the screen they land on', () => {
    for (const [accountType, designation, home] of [
      ['restaurant', 'cashier', 'cashier'],
      ['restaurant', 'kitchen', 'kitchen'],
      ['restaurant', 'waiter', 'tables'],
      ['restaurant', 'Bartender', 'cashier'],
      ['general', 'Sales Rep', 'pos'],
    ] as const) {
      expect(permissionsOf(user({ accountType, designation }))).toContain(home);
    }
  });
});

describe('isOwner', () => {
  it('is true for the owner roles and false for staff', () => {
    expect(isOwner(user({ effectiveRole: 'restaurant_owner' }))).toBe(true);
    expect(isOwner(user({ effectiveRole: 'store_owner' }))).toBe(true);
    expect(isOwner(user({ effectiveRole: 'cashier' }))).toBe(false);
    expect(isOwner(user({ effectiveRole: 'waiter' }))).toBe(false);
  });
});

describe('can', () => {
  it('gates on the resolved set', () => {
    const cashier = user({ accountType: 'restaurant', permissions: ['cashier', 'expenses'] });
    expect(can(cashier, 'expenses')).toBe(true);
    expect(can(cashier, 'products')).toBe(false);
  });
});
