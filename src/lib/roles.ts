import type { AppUser, EffectiveRole } from '@/api/types';

/**
 * The role the app should behave as.
 *
 * The server sends `effectiveRole`, but a build shipped before that field
 * existed — or a profile fetched from an older backend — may not have it.
 * Falling back to the legacy `role` keeps general accounts working during a
 * rollout where the app and API update separately (mobile lags by a store
 * release, so this window is real).
 */
export function effectiveRoleOf(user: AppUser | null | undefined): EffectiveRole {
  if (user?.effectiveRole) return user.effectiveRole;
  if (user?.role === 'admin') return 'super_admin';
  if (user?.role === 'store_owner') {
    return user.accountType === 'restaurant' ? 'restaurant_owner' : 'store_owner';
  }
  return 'cashier';
}

/** Restaurant staff see an entirely different set of screens. */
export function isRestaurantRole(user: AppUser | null | undefined): boolean {
  if (user?.accountType !== 'restaurant') return false;
  const role = effectiveRoleOf(user);
  return role === 'waiter' || role === 'kitchen' || role === 'cashier' || role === 'restaurant_owner';
}
