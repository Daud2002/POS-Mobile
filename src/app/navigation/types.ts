import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Screens reachable from anywhere, pushed on top of the role's tab navigator.
 *
 * Deliberately flat: the web app's sidebar has up to nine destinations for a
 * store owner, which does not fit a tab bar. Four tabs carry the daily work and
 * the rest are pushed from the "More" tab.
 */
export type RootStackParamList = {
  MainTabs: undefined;

  // POS flow
  OrderComplete: { orderId: string };

  // Catalog & operations (pushed from More)
  Products: undefined;
  Categories: undefined;
  Inventory: undefined;
  Customers: undefined;
  CustomerOrders: { customerId: string; customerName: string };
  Employees: undefined;
  Reports: undefined;
  Expenses: undefined;

  // Settings
  Settings: undefined;
  PrinterSetup: undefined;
  ChangePassword: undefined;
};

/** Cashier (`employee`) — three destinations, exactly the web app's nav set. */
export type CashierTabParamList = {
  POS: undefined;
  Orders: undefined;
  More: undefined;
};

/** Store owner — the four daily screens; everything else lives under More. */
export type StoreOwnerTabParamList = {
  Dashboard: undefined;
  POS: undefined;
  Orders: undefined;
  More: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
