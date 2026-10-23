import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { useAuth } from '@/app/providers/AuthProvider';
import { Text } from '@/components/ui/Text';
import { subscriptionAlert, subscriptionMessage } from '@/lib/subscription';
import { tint, useTheme } from '@/theme';

/**
 * The renewal warning at the top of a store's dashboard: amber from three
 * days before the subscription lapses, red from the day before and for as
 * long as it stays lapsed. Renders nothing while the store is paid up or has
 * no expiry recorded at all. Same shape as ConnectionBanner.
 */
export function SubscriptionBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { user } = useAuth();
  const alert = subscriptionAlert(user?.subscriptionExpiresAt);
  const message = subscriptionMessage(alert);
  if (!message) return null;

  const color = alert.level === 'critical' ? theme.colors.destructive : theme.colors.warning;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: tint(color, 0.1),
          borderColor: tint(color, 0.4),
          borderRadius: theme.radius.md,
        },
        style,
      ]}
    >
      <AlertTriangle size={16} color={color} />
      <Text variant="smallMedium" style={{ color, flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
