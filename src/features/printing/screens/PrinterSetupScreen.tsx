import {
  Bluetooth,
  CheckCircle2,
  Printer,
  RefreshCw,
  Unplug,
} from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { KeyValueRow } from '@/components/data/KeyValueRow';
import { SectionCard } from '@/components/data/SectionCard';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { FilterPillRow } from '@/components/ui/FilterPill';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useTheme } from '@/theme/ThemeProvider';

import { DeviceList } from '../components/DeviceList';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { usePrinter } from '../hooks/usePrinter';
import { usePrinterStore } from '../store/printer.store';
import { sampleReceipt } from '../templates/receiptFromOrder';
import { availableTransports } from '../transports';
import { PaperWidth, PrinterDevice, TransportKind } from '../types';

const PAPER_OPTIONS = [
  { value: '58' as const, label: '58 mm (32 cols)' },
  { value: '80' as const, label: '80 mm (48 cols)' },
];

/**
 * Printer discovery, pairing, settings and test printing.
 *
 * This screen has no equivalent on web, where the printer is a free-text
 * Windows printer name typed into the super-admin Stores form and pushed to
 * every device in the store. On mobile the binding is per-device, so the
 * cashier sets it up here.
 */
export function PrinterSetupScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { currency } = useStoreCurrency();

  const { profile, connection, discover, connect, disconnect, discovering, printReceipt } =
    usePrinter();
  const setPaperWidth = usePrinterStore((state) => state.setPaperWidth);
  const updateProfile = usePrinterStore((state) => state.updateProfile);
  const setDevice = usePrinterStore((state) => state.setDevice);
  const lastError = usePrinterStore((state) => state.lastError);

  const transports = availableTransports();
  const [transport, setTransport] = useState<TransportKind>(
    profile.device?.kind ?? (Platform.OS === 'android' ? 'bt-classic' : 'ble'),
  );
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const activeTransport = transports.find((option) => option.kind === transport);

  const handleScan = async () => {
    setDevices([]);
    try {
      setDevices(await discover(transport));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not scan for printers.');
    }
  };

  const handleConnect = async (device: PrinterDevice) => {
    setConnectingId(device.id);
    try {
      await connect(device);
      toast.success(`Connected to ${device.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not connect.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    const result = await printReceipt(sampleReceipt(currency));
    setTesting(false);

    if (result.ok) toast.success('Test receipt sent');
    else toast.error(result.error ?? 'Test print failed');
  };

  const handleForget = async () => {
    await disconnect();
    setDevice(null);
    toast.info('Printer removed');
  };

  return (
    <Screen scrollable>
      {/* Current printer ---------------------------------------------- */}
      <SectionCard
        title="Current printer"
        subtitle={connection === 'connected' ? 'Connected' : 'Not connected'}
      >
        {profile.device ? (
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Printer size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{profile.device.name}</Text>
                <Text variant="caption" color="mutedForeground">
                  {profile.device.kind === 'bt-classic'
                    ? 'Bluetooth Classic'
                    : profile.device.kind === 'ble'
                      ? 'Bluetooth LE'
                      : 'Simulated'}{' '}
                  · {profile.device.id}
                </Text>
              </View>
              {connection === 'connected' ? (
                <CheckCircle2 size={18} color={theme.colors.success} />
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Button
                label={testing ? 'Printing…' : 'Test Print'}
                onPress={handleTestPrint}
                loading={testing}
                disabled={testing}
                style={{ flex: 1 }}
              />
              <Button
                label="Forget"
                variant="outline"
                onPress={handleForget}
                icon={<Unplug size={16} color={theme.colors.foreground} />}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <Text variant="small" color="mutedForeground">
            No printer connected yet. Choose a connection type below and scan.
          </Text>
        )}
      </SectionCard>

      {/* Discovery ------------------------------------------------------ */}
      <SectionCard title="Connect a printer">
        <View style={{ gap: theme.spacing.lg }}>
          <FilterPillRow
            options={transports.map((option) => ({
              value: option.kind,
              label: option.label,
            }))}
            value={transport}
            onChange={(value) => {
              setTransport(value);
              setDevices([]);
            }}
          />

          {activeTransport ? (
            <Text variant="caption" color="mutedForeground">
              {activeTransport.description}
            </Text>
          ) : null}

          {/* The iOS limitation is Apple's MFi requirement, not a bug — say so
              rather than letting the user retry a scan that cannot succeed. */}
          {activeTransport && !activeTransport.supported ? (
            <Card
              padding="lg"
              style={{
                backgroundColor: theme.tint(theme.colors.warning, 0.08),
                borderColor: theme.tint(theme.colors.warning, 0.3),
              }}
            >
              <Text variant="small" color="warning">
                Bluetooth Classic printers are not supported on iOS. Apple requires MFi
                certification, which generic ESC/POS printers do not have — use a
                Bluetooth LE printer instead.
              </Text>
            </Card>
          ) : (
            <>
              <Button
                label={discovering ? 'Scanning…' : 'Scan for printers'}
                onPress={handleScan}
                loading={discovering}
                disabled={discovering}
                fullWidth
                icon={
                  discovering ? undefined : (
                    <RefreshCw size={16} color={theme.colors.primaryForeground} />
                  )
                }
              />

              {transport === 'bt-classic' ? (
                <Text variant="caption" color="mutedForeground">
                  Shows printers already paired in your phone's Bluetooth settings.
                  Pair the printer there first if it is not listed.
                </Text>
              ) : null}

              {discovering ? (
                <View style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
                  <Spinner />
                </View>
              ) : (
                <DeviceList
                  devices={devices}
                  connectedId={profile.device?.id}
                  connectingId={connectingId}
                  onSelect={handleConnect}
                />
              )}

              {lastError ? (
                <Text variant="caption" color="destructive">
                  {lastError}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </SectionCard>

      {/* Settings ------------------------------------------------------- */}
      <SectionCard title="Receipt settings">
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="smallMedium">Paper width</Text>
            <FilterPillRow
              options={PAPER_OPTIONS}
              value={String(profile.paperWidth) as '58' | '80'}
              onChange={(value) => setPaperWidth(Number(value) as PaperWidth)}
              scrollable={false}
            />
          </View>

          <Divider />

          <ToggleRow
            label="Cut paper automatically"
            description="Sends a partial cut after each receipt"
            value={profile.autoCut}
            onChange={(autoCut) => updateProfile({ autoCut })}
          />

          <ToggleRow
            label="Open cash drawer"
            description="Pulses the drawer connector after printing"
            value={profile.openCashDrawer}
            onChange={(openCashDrawer) => updateProfile({ openCashDrawer })}
          />

          <Divider />

          <KeyValueRow label="Characters per line" value={String(profile.charsPerLine)} />
          <KeyValueRow label="Copies per sale" value={String(profile.copies)} />
        </View>
      </SectionCard>

      {/* Preview -------------------------------------------------------- */}
      <SectionCard
        title="Receipt preview"
        subtitle="Exactly what will print at the current settings"
      >
        <ReceiptPreview data={sampleReceipt(currency)} profile={profile} />
      </SectionCard>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        <Bluetooth size={14} color={theme.colors.mutedForeground} />
        <Text variant="caption" color="mutedForeground" style={{ flex: 1 }}>
          Printer settings are stored on this device only. Each phone or tablet connects
          to its own printer.
        </Text>
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
      <View style={{ flex: 1 }}>
        <Text variant="smallMedium">{label}</Text>
        <Text variant="caption" color="mutedForeground">
          {description}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
