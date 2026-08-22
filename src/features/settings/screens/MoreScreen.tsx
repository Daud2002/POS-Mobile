import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BarChart3,
  ChevronRight,
  FolderTree,
  Package,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  UserSquare,
  Warehouse,
} from 'lucide-react-native';
import { ComponentType } from 'react';
import { View } from 'react-native';

import { RootStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/app/providers/AuthProvider';
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
}

/**
 * Store-owner destinations that don't fit in the tab bar.
 *
 * This is the web sidebar's `store_owner` nav minus the four tab screens. The
 * whole `admin` branch of that nav is intentionally absent — the mobile app has
 * no super-admin panel.
 */
const STORE_OWNER_MENU: Array<{ title: string; items: MenuEntry[] }> = [
  {
    title: 'Catalog',
    items: [
      {
        route: 'Products',
        label: 'Products',
        description: 'Catalog, pricing and stock levels',
        icon: ShoppingBag,
        tone: 'primary',
      },
      {
        route: 'Categories',
        label: 'Categories',
        description: 'Group products for the POS grid',
        icon: FolderTree,
        tone: 'accent',
      },
      {
        route: 'Inventory',
        label: 'Inventory',
        description: 'Adjust stock and spot low items',
        icon: Warehouse,
        tone: 'warning',
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
      },
      {
        route: 'Employees',
        label: 'Employees',
        description: 'Staff accounts and access',
        icon: UserSquare,
        tone: 'accent',
      },
      {
        route: 'Reports',
        label: 'Reports',
        description: 'Revenue, orders and payment mix',
        icon: BarChart3,
        tone: 'primary',
      },
    ],
  },
];

/** Cashiers get only Settings here — their tab bar already covers POS and Orders. */
const CASHIER_MENU: typeof STORE_OWNER_MENU = [];

export function MoreScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const groups = user?.role === 'store_owner' ? STORE_OWNER_MENU : CASHIER_MENU;

  return (
    <Screen scrollable edges={['top', 'bottom']}>
      <SectionHeader title="More" subtitle="Manage your store" />

      {groups.map((group) => (
        <View key={group.title} style={{ gap: theme.spacing.md }}>
          <Text variant="overline" color="mutedForeground">
            {group.title}
          </Text>
          <Card padding="none">
            {group.items.map(({ route, label, description, icon: Icon, tone }, rowIndex) => (
              <SettingsRow
                key={route}
                icon={<Icon size={18} color={theme.colors[tone]} />}
                color={theme.colors[tone]}
                label={label}
                description={description}
                divided={rowIndex < group.items.length - 1}
                onPress={() => navigation.navigate(route as never)}
                trailing={<ChevronRight size={18} color={theme.colors.mutedForeground} />}
              />
            ))}
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
