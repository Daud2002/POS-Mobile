import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronRight,
  LogOut,
  Lock,
  Monitor,
  Moon,
  Printer,
  Sun,
} from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RootStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FilterPillRow } from '@/components/ui/FilterPill';
import { Text } from '@/components/ui/Text';
import { usePrinterStore } from '@/features/printing/store/printer.store';
import { ThemeMode, useTheme, useThemeMode } from '@/theme/ThemeProvider';

import { SettingsRow } from '../components/SettingsRow';

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Profile, printer, appearance and sign-out.
 *
 * The web Settings page is read-only — its Password tab is a static notice
 * saying "Password management is currently handled by your administrator", and
 * its Store tab is gated on a `manager` role that no longer exists, so it never
 * renders. Change Password is real here (and has been added to the web app too).
 */
export function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const { mode, setMode } = useThemeMode();
  const printer = usePrinterStore((state) => state.profile);

  const [confirmLogout, setConfirmLogout] = useState(false);

  const ThemeIcon = THEME_ICONS[mode];

  const roleLabel =
    user?.role === 'store_owner'
      ? 'Store Owner'
      : user?.role === 'employee'
        ? 'Cashier'
        : (user?.role ?? '');

  return (
    <Screen scrollable>
      <SectionHeader title="Settings" subtitle="Manage your account and device" />

      <Card padding="xl">
        <View style={[styles.profile, { gap: theme.spacing.lg }]}>
          <Avatar name={user?.name} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="h2" numberOfLines={1}>
              {user?.name ?? 'Account'}
            </Text>
            <Text variant="small" color="mutedForeground" numberOfLines={1}>
              {user?.email}
            </Text>
            <Text
              variant="caption"
              style={{ color: theme.colors.primary, marginTop: theme.spacing.xxs }}
            >
              {roleLabel}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="overline" color="mutedForeground">
          Account
        </Text>

        <Card padding="none">
          <SettingsRow
            icon={<Lock size={18} color={theme.colors.accent} />}
            color={theme.colors.accent}
            label="Change Password"
            description="Update the password you sign in with"
            onPress={() => navigation.navigate('ChangePassword')}
            trailing={<ChevronRight size={18} color={theme.colors.mutedForeground} />}
          />
        </Card>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="overline" color="mutedForeground">
          Receipt printing
        </Text>

        <Card padding="none">
          <SettingsRow
            icon={<Printer size={18} color={theme.colors.primary} />}
            label="Printer Setup"
            description={
              printer.device
                ? `${printer.device.name} · ${printer.paperWidth}mm`
                : 'No printer connected'
            }
            onPress={() => navigation.navigate('PrinterSetup')}
            trailing={<ChevronRight size={18} color={theme.colors.mutedForeground} />}
          />
        </Card>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="overline" color="mutedForeground">
          Appearance
        </Text>

        <Card padding="xl">
          <View style={[styles.themeHeader, { gap: theme.spacing.md }]}>
            <ThemeIcon size={18} color={theme.colors.primary} />
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              Theme
            </Text>
          </View>
          <FilterPillRow
            options={THEME_OPTIONS}
            value={mode}
            onChange={setMode}
            scrollable={false}
            style={{ marginTop: theme.spacing.lg }}
          />
        </Card>
      </View>

      <Button
        label="Log out"
        variant="outline"
        fullWidth
        icon={<LogOut size={18} color={theme.colors.destructive} />}
        onPress={() => setConfirmLogout(true)}
      />

      <ConfirmDialog
        open={confirmLogout}
        title="Log out"
        description="Are you sure you want to log out of your account?"
        confirmLabel="Log out"
        declineLabel="Stay"
        onConfirm={async () => {
          setConfirmLogout(false);
          await logout();
        }}
        onDecline={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center' },
  themeHeader: { flexDirection: 'row', alignItems: 'center' },
});
