import type { AppUser, PermissionKey } from '@/api/types';

import { effectiveRoleOf } from './roles';

/**
 * Module access, mirroring Backend/src/common/permissions.ts.
 *
 * Named `access` rather than `permissions` because lib/permissions.ts already
 * means Android runtime permissions (Bluetooth, location) — two unrelated
 * ideas that must not share a filename.
 *
 * The server is authoritative and re-checks every request; this exists so the
 * app knows which tabs and menu rows to render.
 */
const RESTAURANT_MODULES: PermissionKey[] = [
  'dashboard', 'expenses', 'cashier', 'kitchen', 'tables', 'products', 'categories', 'orders',
];

const GENERAL_MODULES: PermissionKey[] = [
  'dashboard', 'expenses', 'pos', 'products', 'categories', 'orders', 'customers', 'inventory',
];

/** The one module a staff member always holds — their landing screen. */
const RESTAURANT_BASE: Record<string, PermissionKey> = {
  cashier: 'cashier',
  kitchen: 'kitchen',
  waiter: 'tables',
};

const GENERAL_BASE: PermissionKey = 'pos';

const norm = (designation?: string | null) => (designation ?? '').trim().toLowerCase();

/**
 * The module a staff member always holds — their landing screen.
 *
 * An unrecognised restaurant designation degrades to CASHIER, matching
 * effectiveRoleOf(), which also falls through to 'cashier'. The two must
 * agree: a failed permission check sends the user to their home screen, and
 * home is chosen by effective role — if that said 'cashier' while this said
 * 'pos', the redirect would bounce between two screens forever.
 */
export function basePermissionFor(
  accountType?: string | null,
  designation?: string | null,
): PermissionKey {
  if (accountType !== 'restaurant') return GENERAL_BASE;
  return RESTAURANT_BASE[norm(designation)] ?? RESTAURANT_BASE.cashier;
}

/**
 * The modules this user may open.
 *
 * `permissions` comes from /auth/me. Deriving a fallback matters more here
 * than on the web: a store build lags the API by a release, so an app in a
 * user's hands can be talking to a backend it predates.
 */
export function permissionsOf(user: AppUser | null | undefined): PermissionKey[] {
  if (user?.permissions?.length) return user.permissions;

  const role = effectiveRoleOf(user);
  if (role === 'super_admin') return [...new Set([...RESTAURANT_MODULES, ...GENERAL_MODULES])];
  if (role === 'restaurant_owner') return [...RESTAURANT_MODULES];
  if (role === 'store_owner') return [...GENERAL_MODULES];

  return [basePermissionFor(user?.accountType, user?.designation)];
}

export function can(
  user: AppUser | null | undefined,
  permission: PermissionKey,
): boolean {
  return permissionsOf(user).includes(permission);
}

/** True for the two owner roles — what gates owner-only screens. */
export function isOwner(user: AppUser | null | undefined): boolean {
  const role = effectiveRoleOf(user);
  return role === 'store_owner' || role === 'restaurant_owner' || role === 'super_admin';
}

/** Labels for the permission list on the staff screen. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: 'Dashboard',
  expenses: 'Expenses',
  pos: 'POS',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
  tables: 'Tables',
  products: 'Products / Menu',
  categories: 'Categories',
  orders: 'Orders',
  customers: 'Customers',
  inventory: 'Inventory',
};

export const PERMISSION_HINTS: Record<PermissionKey, string> = {
  dashboard: 'Revenue, orders and spend at a glance',
  expenses: 'Record and manage store expenses',
  pos: 'Take sales on the POS',
  cashier: 'Settle bills, discounts and takeaway orders',
  kitchen: 'See and progress kitchen tickets',
  tables: 'Table service and table management',
  products: 'Add and edit what you sell',
  categories: 'Group products for the order screen',
  orders: 'Full order history',
  customers: 'Contacts and purchase history',
  inventory: 'Stock levels and restocking',
};
