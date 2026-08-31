import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { useAuth } from '@/app/providers/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';
import { CategoriesScreen } from '@/features/categories/screens/CategoriesScreen';
import { CustomerOrdersScreen } from '@/features/customers/screens/CustomerOrdersScreen';
import { CustomersScreen } from '@/features/customers/screens/CustomersScreen';
import { EmployeesScreen } from '@/features/employees/screens/EmployeesScreen';
import { ExpensesScreen } from '@/features/expenses/screens/ExpensesScreen';
import { InventoryScreen } from '@/features/inventory/screens/InventoryScreen';
import { OrderCompleteScreen } from '@/features/pos/screens/OrderCompleteScreen';
import { PrinterSetupScreen } from '@/features/printing/screens/PrinterSetupScreen';
import { ProductsScreen } from '@/features/products/screens/ProductsScreen';
import { ReportsScreen } from '@/features/reports/screens/ReportsScreen';
import { ChangePasswordScreen } from '@/features/settings/screens/ChangePasswordScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { CashiersScreen } from '@/features/shifts/screens/CashiersScreen';
import { ShiftsScreen } from '@/features/shifts/screens/ShiftsScreen';
import { ShiftDetailScreen } from '@/features/shifts/screens/ShiftDetailScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { useTheme } from '@/theme/ThemeProvider';

import { MainTabs } from './MainTabs';
import { toNavigationTheme } from './navigationTheme';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();

/**
 * Auth gate + app stack.
 *
 * There is no super-admin branch. The web router has six `/admin/*` routes
 * behind a `roles={['admin']}` guard; none of them exist here.
 */
export function RootNavigator() {
  const theme = useTheme();
  const { isAuthenticated, loading } = useAuth();

  const navTheme = toNavigationTheme(theme);

  // Held until the stored token is hydrated AND /auth/me has returned, because
  // `storeId` arrives with the profile and every store-scoped screen needs it.
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? (
        <Stack.Navigator
          screenOptions={{
            // Pushed screens slide in from the right on native. On web the
            // native-stack has no transitions, so PageFade inside each screen
            // carries the entrance there.
            animation: 'slide_from_right',
            // Header matches the page background so screens read as one
            // surface instead of a bar bolted on top.
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.foreground,
            headerTitleStyle: {
              fontFamily: theme.fontFamily.heading,
              fontSize: theme.fontSize.md,
            },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="OrderComplete"
            component={OrderCompleteScreen}
            options={{
              title: 'Order Complete',
              // Back would return to a cart that checkout already cleared.
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />

          <Stack.Screen
            name="Products"
            component={ProductsScreen}
            options={{ title: 'Products' }}
          />
          <Stack.Screen
            name="Categories"
            component={CategoriesScreen}
            options={{ title: 'Categories' }}
          />
          <Stack.Screen
            name="Inventory"
            component={InventoryScreen}
            options={{ title: 'Inventory' }}
          />
          <Stack.Screen
            name="Customers"
            component={CustomersScreen}
            options={{ title: 'Customers' }}
          />
          <Stack.Screen
            name="CustomerOrders"
            component={CustomerOrdersScreen}
            options={({ route }) => ({ title: route.params.customerName })}
          />
          <Stack.Screen
            name="Employees"
            component={EmployeesScreen}
            options={{ title: 'Employees' }}
          />
          <Stack.Screen
            name="Reports"
            component={ReportsScreen}
            options={{ title: 'Reports' }}
          />
          <Stack.Screen
            name="Expenses"
            component={ExpensesScreen}
            options={{ title: 'Expenses' }}
          />

          <Stack.Screen
            name="Cashiers"
            component={CashiersScreen}
            options={{ title: 'Cashiers' }}
          />
          <Stack.Screen
            name="Shifts"
            component={ShiftsScreen}
            options={({ route }) => ({ title: route.params?.name ?? 'Shifts' })}
          />
          <Stack.Screen
            name="ShiftDetail"
            component={ShiftDetailScreen}
            options={{ title: 'Shift' }}
          />

          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="PrinterSetup"
            component={PrinterSetupScreen}
            options={{ title: 'Printer Setup' }}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{ title: 'Change Password' }}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
