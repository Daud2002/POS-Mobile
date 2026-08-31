import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BarChart3,
  ChevronRight,
  FolderTree,
  HandCoins,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  UserSquare,
  Wallet,
  Warehouse,
} from 'lucide-react-native';
import { ComponentType } from 'react';
import { View } from 'react-native';

import { RootStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/app/providers/AuthProvider';
import type { PermissionKey } from '@/api/types';
import { isOwner, permissionsOf } from '@/lib/access';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { ColorTokens } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

import { SettingsRow } from '../components/SettingsRow';

interface MenuEntry {
  route: keyof RootStackParamList;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  /** Icon chip tone — varied per row so the menu scans by color. */
  tone: keyof Pick<ColorTokens, 'primary' | 'accent' | 'info' | 'warning' | 'destructive'>;
  /** The module that unlocks this row. Omitted rows are owner-only. */
  permission?: PermissionKey;
  /** Restricts the row to one account type. */
  accountType?: 'general' | 'restaurant';
  /** Restaurant tenants call the same screen something else. */
  restaurantLabel?: string;
  restaurantDescription?: string;
}

/**
 * Everything that does not fit in the tab bar.
 *
 * Rows are gated by MODULE, not role, so a cashier granted expenses finds
 * Expenses here without a second menu table. The two owner-only rows carry no
 * `permission` — they cannot be delegated, so there is no module for them.
 */
const MENU: Array<{ title: string; items: MenuEntry[] }> = [
  {
    title: 'Catalog',
    items: [
      {
        route: 'Products',
        label: 'Products',
        description: 'Catalog, pricing and stock levels',
        restaurantLabel: 'Dishes',
        restaurantDescription: 'Names, prices and cost for profit',
        icon: ShoppingBag,
        tone: 'primary',
        permission: 'products',
      },
      {
        route: 'Categories',
        label: 'Categories',
        description: 'Group products for the POS grid',
        restaurantDescription: 'Group dishes for the order screen',
        icon: FolderTree,
        tone: 'accent',
        permission: 'categories',
      },
      {
        // Restaurant accounts do not track stock.
        route: 'Inventory',
        label: 'Inventory',
        description: 'Adjust stock and spot low items',
        icon: Warehouse,
        tone: 'warning',
        permission: 'inventory',
        accountType: 'general',
      },
    ],
  },
  {
    title: 'Money',
    items: [
      {
        route: 'Expenses',
        label: 'Expenses',
        description: "What the store has spent, and today's total",
        icon: Wallet,
        tone: 'warning',
        permission: 'expenses',
      },
      {
        /**
         * Owner-only, so it carries no `permission` — entries without one are
         * filtered to owners, the same way Employees is.
         */
        route: 'Cashiers',
        label: 'Cashiers',
        description: 'What each cashier collected, and what is still to collect',
        icon: HandCoins,
        tone: 'primary',
        accountType: 'restaurant',
      },
    ],
  },
  {
    title: 'People & insights',
    items: [
      {
        route: 'Customers',
        label: 'Customers',
        description: 'Contacts and purchase history',
        icon: Users,
        tone: 'info',
        permission: 'customers',
        accountType: 'general',
      },
      {
        route: 'Employees',
        label: 'Employees',
        description: 'Staff accounts and permissions',
        restaurantLabel: 'Staff',
        restaurantDescription: 'Waiters, kitchen, cashiers and their permissions',
        icon: UserSquare,
        tone: 'accent',
      },
      {
        route: 'Reports',
        label: 'Reports',
        description: 'Revenue, orders and payment mix',
        icon: BarChart3,
        tone: 'primary',
        accountType: 'general',
      },
    ],
  },
];

export function MoreScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const isRestaurant = user?.accountType === 'restaurant';
  const granted = permissionsOf(user);
  const owner = isOwner(user);

  const groups = MENU.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => {
      if (item.accountType && (item.accountType === 'restaurant') !== isRestaurant) return false;
      // No `permission` means the row cannot be delegated at all.
      return item.permission ? granted.includes(item.permission) : owner;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <Screen scrollable edges={['top', 'bottom']}>
      <SectionHeader title="More" subtitle="Manage your store" />

      {groups.map((group) => (
        <View key={group.title} style={{ gap: theme.spacing.md }}>
          <Text variant="overline" color="mutedForeground">
            {group.title}
          </Text>
          <Card padding="none">
            {group.items.map((item, rowIndex) => {
              const Icon = item.icon;
              return (
                <SettingsRow
                  key={item.route}
                  icon={<Icon size={18} color={theme.colors[item.tone]} />}
                  color={theme.colors[item.tone]}
                  label={(isRestaurant && item.restaurantLabel) || item.label}
                  description={
                    (isRestaurant && item.restaurantDescription) || item.description
                  }
                  divided={rowIndex < group.items.length - 1}
                  onPress={() => navigation.navigate(item.route as never)}
                  trailing={<ChevronRight size={18} color={theme.colors.mutedForeground} />}
                />
              );
            })}
          </Card>
        </View>
      ))}

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="overline" color="mutedForeground">
          Account
        </Text>
        <Card padding="none">
          <SettingsRow
            icon={<SettingsIcon size={18} color={theme.colors.info} />}
            color={theme.colors.info}
            label="Settings"
            description="Profile, printer, theme and sign-out"
            onPress={() => navigation.navigate('Settings')}
            trailing={<ChevronRight size={18} color={theme.colors.mutedForeground} />}
          />
        </Card>
      </View>
    </Screen>
  );
}
