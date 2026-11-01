import { View, StyleSheet } from 'react-native';
import { AlertTriangle, CloudOff, Server, WifiOff } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { Text } from '@/components/ui';
import { describeConnection, type ConnectionLine, type ConnectionTone } from '@/lib/connection/status';
import { useConnection } from '@/lib/connection/useConnection';
import { tint, useTheme, type Theme } from '@/theme';

const TONE_ICON: Record<ConnectionTone, ComponentType<{ size?: number; color?: string }>> = {
  danger: WifiOff,
  warning: AlertTriangle,
  info: CloudOff,
  muted: Server,
};

function toneColor(theme: Theme, tone: ConnectionTone): string {
  switch (tone) {
    case 'danger':
      return theme.colors.destructive;
    case 'warning':
      return theme.colors.warning;
    case 'info':
      return theme.colors.info;
    default:
      return theme.colors.mutedForeground;
  }
}

/**
 * The connection strip at the top of the restaurant screens.
 *
 * Two things can go wrong out of sight, and both look identical to a quiet
 * service, which is how tickets get missed:
 *  - live updates drop (the socket). The screen still refreshes on the
 *    polling fallback, so the wording says degraded, not broken;
 *  - on a shop running its own store server, the phone loses that server, or
 *    the server stops taking orders.
 * The more serious one wins the single line. On a healthy store server it
 * stays as a quiet "Store server · synced 2 min ago", so staff can see the
 * shop is running locally; on the cloud it shows nothing.
 */
export function ConnectionBanner({ connected }: { connected: boolean }) {
  const { mode, storeHealth, localStatus } = useConnection();
  const line = describeConnection({ mode, health: storeHealth, status: localStatus });

  // Server unreachable or refusing orders: worse than missing live updates.
  if (line && (line.tone === 'danger' || line.tone === 'warning')) {
    return <Strip line={line} />;
  }

  if (!connected) {
    return (
      <Strip
        line={{
          tone: 'danger',
          text: 'Live updates disconnected — still checking every 10s. Reconnecting…',
        }}
        wrap
      />
    );
  }

  return line ? <Strip line={line} /> : null;
}

/** One line; only the long socket message may wrap. */
function Strip({ line: { tone, text }, wrap = false }: { line: ConnectionLine; wrap?: boolean }) {
  const theme = useTheme();
  const color = toneColor(theme, tone);
  const Icon = TONE_ICON[tone];
  const quiet = tone === 'muted';

  return (
    <View
      accessibilityRole={quiet ? undefined : 'alert'}
      style={[
        styles.container,
        {
          backgroundColor: quiet ? theme.colors.muted : tint(color, 0.1),
          borderColor: quiet ? theme.colors.border : tint(color, 0.4),
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <Icon size={16} color={color} />
      <Text variant="caption" style={{ color, flex: 1 }} numberOfLines={wrap ? undefined : 1}>
        {text}
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
