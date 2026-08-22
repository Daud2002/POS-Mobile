import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutGrid, Menu, Receipt, ShoppingCart } from 'lucide-react-native';

import { useAuth } from '@/app/providers/AuthProvider';
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen';
import { OrdersScreen } from '@/features/orders/screens/OrdersScreen';
import { POSScreen } from '@/features/pos/screens/POSScreen';
import { MoreScreen } from '@/features/settings/screens/MoreScreen';

import { TabBar } from './TabBar';

const Tab = createBottomTabNavigator();

/**
 * Role-based tabs, rendered by the custom floating TabBar.
 *
 * The web sidebar has up to nine destinations for a store owner, which does not
 * fit a tab bar — the four daily screens get tabs and the rest live under More.
 * A cashier has three destinations, exactly as on web.
 */
export function MainTabs() {
  const { user } = useAuth();
  const isStoreOwner = user?.role === 'store_owner';

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Cross-fade + slight shift between tab scenes on every switch.
        animation: 'shift',
      }}
    >
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
