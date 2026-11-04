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
  /** Restaurant ingredients (ml, g, bottles) drawn down by recipes. */
  RestaurantInventory: undefined;
  Customers: undefined;
  CustomerOrders: { customerId: string; customerName: string };
  Employees: undefined;
  Reports: undefined;
  Expenses: undefined;
  /** Restaurant: quantity and sales per menu item, per day or month. */
  ItemSales: undefined;

  // Cashier shifts (owner). `Shifts` narrows to one cashier when pushed from
  // the Cashiers summary.
  Cashiers: undefined;
  Shifts: { userId?: string; name?: string } | undefined;
  ShiftDetail: { shiftId: string };

  // Settings
  Settings: undefined;
  PrinterSetup: undefined;
  ChangePassword: undefined;
  /** Pair with / check / forget the shop's store server. Also in the signed-out stack. */
  ConnectStoreServer: undefined;
};

/**
 * Signed out. The connect screen is here too: a staff phone has to reach the
 * store server BEFORE it can sign in, because the cloud refuses staff once
 * the shop runs on one.
 */
export type AuthStackParamList = {
  Login: undefined;
  ConnectStoreServer: undefined;
};

/**
 * Restaurant tab bar. Only `Tables` takes a param: My Orders hands a live
 * order across so the waiter lands on the menu already adding a round to it.
 */
export type RestaurantTabParamList = {
  Dashboard: undefined;
  MyShift: undefined;
  Tables: { appendToOrderId?: string } | undefined;
  MyOrders: undefined;
  Cashier: undefined;
  Kitchen: undefined;
  Orders: undefined;
  More: undefined;
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
