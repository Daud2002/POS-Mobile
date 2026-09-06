import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ChefHat, ClipboardList, LayoutGrid, Menu, Receipt, ShoppingCart, UtensilsCrossed, Wallet,
} from 'lucide-react-native';
import type { ComponentType } from 'react';

import { useAuth } from '@/app/providers/AuthProvider';
import type { PermissionKey } from '@/api/types';
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen';
import { OrdersScreen } from '@/features/orders/screens/OrdersScreen';
import { POSScreen } from '@/features/pos/screens/POSScreen';
import { MoreScreen } from '@/features/settings/screens/MoreScreen';
import { WaiterScreen } from '@/features/restaurant/screens/WaiterScreen';
import { MyOrdersScreen } from '@/features/restaurant/screens/MyOrdersScreen';
import { KitchenScreen } from '@/features/restaurant/screens/KitchenScreen';
import { RestaurantCashierScreen } from '@/features/restaurant/screens/RestaurantCashierScreen';
import { RestaurantDashboardScreen } from '@/features/restaurant/screens/RestaurantDashboardScreen';
import { RestaurantOrdersScreen } from '@/features/restaurant/screens/RestaurantOrdersScreen';
import { CashierDashboardScreen } from '@/features/shifts/screens/CashierDashboardScreen';
import { isOwner, permissionsOf } from '@/lib/access';

import { TabBar } from './TabBar';

const Tab = createBottomTabNavigator();

interface TabSpec {
  name: string;
  /** What the tab bar shows. Defaults to `name`. */
  title?: string;
  permission: PermissionKey;
  component: ComponentType<any>;
  icon: ComponentType<{ color?: string; size?: number }>;
  /** A staff-only tab: owners have a fuller screen elsewhere. */
  staffOnly?: boolean;
}

/**
 * Restaurant tabs, in the order they appear.
 *
 * Kitchen is handled specially below — see the filter in MainTabs.
 */
const RESTAURANT_TABS: TabSpec[] = [
  { name: 'Dashboard', permission: 'dashboard', component: RestaurantDashboardScreen, icon: LayoutGrid },
  /**
   * The cashier's OWN dashboard — only what they collected.
   *
   * A separate tab rather than swapping the Dashboard tab's component: an
   * owner holds `cashier` too, so reusing the name would give them two tabs
   * called Dashboard, and two Tab.Screens sharing a name crash
   * react-navigation. Filtered to non-owners below.
   */
  { name: 'MyShift', permission: 'cashier', component: CashierDashboardScreen, icon: Wallet, staffOnly: true },
  { name: 'Tables', permission: 'tables', component: WaiterScreen, icon: UtensilsCrossed },
  /**
   * The waiter's OWN open orders, table by table, with a way to add to
   * them. Staff only: an owner never opens orders, so theirs would be empty,
   * and they have the full Orders history instead.
   */
  { name: 'MyOrders', title: 'My Orders', permission: 'tables', component: MyOrdersScreen, icon: ClipboardList, staffOnly: true },
  { name: 'Cashier', permission: 'cashier', component: RestaurantCashierScreen, icon: Receipt },
  { name: 'Kitchen', permission: 'kitchen', component: KitchenScreen, icon: ChefHat },
  { name: 'Orders', permission: 'orders', component: RestaurantOrdersScreen, icon: ClipboardList },
];

const GENERAL_TABS: TabSpec[] = [
  { name: 'Dashboard', permission: 'dashboard', component: DashboardScreen, icon: LayoutGrid },
  { name: 'POS', permission: 'pos', component: POSScreen, icon: ShoppingCart },
  { name: 'Orders', permission: 'orders', component: OrdersScreen, icon: Receipt },
];

/**
 * Tabs built from the user's MODULES rather than their role.
 *
 * Every previous role branch falls out of this: a waiter holds only `tables`
 * and gets Tables + More exactly as before, and an owner holds every module
 * their account type has, which reproduces the owner tab bars. What is new is
 * that a cashier granted the dashboard now gets a Dashboard tab without a
 * further branch here.
 *
 * The set is naturally bounded — the widest is four tabs plus More — because
 * modules like expenses and the catalogue live under More rather than in the
 * tab bar.
 */
export function MainTabs() {
  const { user } = useAuth();
  const isRestaurant = user?.accountType === 'restaurant';
  const granted = permissionsOf(user);
  const owner = isOwner(user);

  const screenOptions = {
    headerShown: false,
    // Cross-fade + slight shift between tab scenes on every switch.
    animation: 'shift',
  } as const;

  const tabs = (isRestaurant ? RESTAURANT_TABS : GENERAL_TABS).filter((tab) => {
    if (!granted.includes(tab.permission)) return false;
    // An owner holds `kitchen` like every other module, but the kitchen
    // display is a station screen, not something an owner works from. Keeping
    // it out preserves the owner's existing four-tab bar; kitchen staff still
    // get it, because it is their base module.
    if (tab.permission === 'kitchen' && owner) return false;
    // The owner has the full dashboard and history; the per-person tabs
    // (My Shift, My Orders) are for staff.
    if (tab.staffOnly && owner) return false;
    return true;
  });

  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={screenOptions}>
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: tab.title ?? tab.name,
            tabBarIcon: ({ color, size }) => <tab.icon color={color} size={size} />,
          }}
        />
      ))}

      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
