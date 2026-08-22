import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChefHat, ClipboardList, LayoutGrid, Menu, Receipt, ShoppingCart, UtensilsCrossed } from 'lucide-react-native';

import { useAuth } from '@/app/providers/AuthProvider';
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen';
import { OrdersScreen } from '@/features/orders/screens/OrdersScreen';
import { POSScreen } from '@/features/pos/screens/POSScreen';
import { MoreScreen } from '@/features/settings/screens/MoreScreen';
import { WaiterScreen } from '@/features/restaurant/screens/WaiterScreen';
import { KitchenScreen } from '@/features/restaurant/screens/KitchenScreen';
import { RestaurantCashierScreen } from '@/features/restaurant/screens/RestaurantCashierScreen';
import { RestaurantDashboardScreen } from '@/features/restaurant/screens/RestaurantDashboardScreen';
import { RestaurantOrdersScreen } from '@/features/restaurant/screens/RestaurantOrdersScreen';
import { effectiveRoleOf } from '@/lib/roles';

import { TabBar } from './TabBar';

const Tab = createBottomTabNavigator();

/**
 * Role-based tabs, rendered by the custom floating TabBar.
 *
 * Branches on the SERVER-derived effective role rather than `user.role`,
 * because every restaurant employee is stored as role 'employee' and only
 * their designation distinguishes a waiter from the kitchen. General accounts
 * resolve to the same two shapes as before, so their tabs are unchanged.
 */
export function MainTabs() {
  const { user } = useAuth();
  const role = effectiveRoleOf(user);
  const isRestaurant = user?.accountType === 'restaurant';

  const screenOptions = {
    headerShown: false,
    // Cross-fade + slight shift between tab scenes on every switch.
    animation: 'shift',
  } as const;

  if (isRestaurant && role === 'waiter') {
    return (
      <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={screenOptions}>
        <Tab.Screen
          name="Tables"
          component={WaiterScreen}
          options={{ tabBarIcon: ({ color, size }) => <UtensilsCrossed color={color} size={size} /> }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{ tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
        />
      </Tab.Navigator>
    );
  }

  if (isRestaurant && role === 'kitchen') {
    return (
      <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={screenOptions}>
        <Tab.Screen
          name="Kitchen"
          component={KitchenScreen}
          options={{ tabBarIcon: ({ color, size }) => <ChefHat color={color} size={size} /> }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{ tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
        />
      </Tab.Navigator>
    );
  }

  if (isRestaurant && role === 'cashier') {
    return (
      <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={screenOptions}>
        <Tab.Screen
          name="Cashier"
          component={RestaurantCashierScreen}
          options={{ tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Orders"
          component={RestaurantOrdersScreen}
          options={{ tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{ tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
        />
      </Tab.Navigator>
    );
  }

  if (role === 'restaurant_owner') {
    return (
      <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={screenOptions}>
        <Tab.Screen
          name="Dashboard"
          component={RestaurantDashboardScreen}
          options={{ tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Tables"
          component={WaiterScreen}
          options={{ tabBarIcon: ({ color, size }) => <UtensilsCrossed color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Cashier"
          component={RestaurantCashierScreen}
          options={{ tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Orders"
          component={RestaurantOrdersScreen}
          options={{ tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{ tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
        />
      </Tab.Navigator>
    );
  }

  // General accounts — unchanged from before the restaurant work.
  const isStoreOwner = role === 'store_owner';

  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={screenOptions}>
      {isStoreOwner ? (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
          }}
        />
      ) : null}

      <Tab.Screen
        name="POS"
        component={POSScreen}
        options={{
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
