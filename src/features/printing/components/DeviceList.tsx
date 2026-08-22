import { CheckCircle2, Printer } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

import { PrinterDevice } from '../types';

interface DeviceListProps {
  devices: PrinterDevice[];
  connectedId?: string;
  connectingId: string | null;
  onSelect: (device: PrinterDevice) => void;
}

/** Discovered printers, tappable to connect. */
export function DeviceList({
  devices,
  connectedId,
  connectingId,
  onSelect,
}: DeviceListProps) {
  const theme = useTheme();

  if (devices.length === 0) {
    return (
      <Text variant="caption" color="mutedForeground">
        No printers found yet. Make sure the printer is switched on, then scan.
      </Text>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {devices.map((device) => {
        const isConnected = device.id === connectedId;
        const isConnecting = device.id === connectingId;

        return (
          <Pressable
            key={device.id}
            onPress={() => onSelect(device)}
            disabled={isConnecting}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.lg,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: isConnected ? theme.colors.primary : theme.colors.border,
              backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
            })}
          >
            <Printer
              size={18}
              color={isConnected ? theme.colors.primary : theme.colors.mutedForeground}
            />

            <View style={{ flex: 1 }}>
              <Text variant="smallMedium" numberOfLines={1}>
                {device.name}
              </Text>
              <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                {device.id}
                {device.rssi !== undefined ? ` · ${device.rssi} dBm` : ''}
                {device.paired ? ' · paired' : ''}
              </Text>
            </View>

            {isConnecting ? (
              <Spinner />
            ) : isConnected ? (
              <CheckCircle2 size={18} color={theme.colors.primary} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
