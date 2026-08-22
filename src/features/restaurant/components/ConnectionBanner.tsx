import { View, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { tint, useTheme } from '@/theme';

/**
 * Explicit "live updates are down" strip.
 *
 * A device that quietly stops receiving orders looks identical to a quiet
 * service, which is how tickets get missed. The screen still refreshes on the
 * polling fallback while this shows, so the wording says degraded, not broken.
 */
export function ConnectionBanner({ connected }: { connected: boolean }) {
  const theme = useTheme();
  if (connected) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tint(theme.colors.destructive, 0.1),
          borderColor: tint(theme.colors.destructive, 0.4),
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <WifiOff size={16} color={theme.colors.destructive} />
      <Text variant="caption" style={{ color: theme.colors.destructive, flex: 1 }}>
        Live updates disconnected — still checking every 10s. Reconnecting…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
