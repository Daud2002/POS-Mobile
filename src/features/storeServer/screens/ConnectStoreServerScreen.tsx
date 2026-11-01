import { useNavigation } from '@react-navigation/native';
import { Keyboard, QrCode, RefreshCw, Server, Trash2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { apiClient } from '@/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { connectToStoreServer, forgetStoreServer } from '@/lib/connection/connectionStore';
import { checkStoreServer, type ProbeFailure } from '@/lib/connection/probe';
import {
  parseServerAddress,
  parseSetupQr,
  serverLabel,
  type StoreServerAddress,
} from '@/lib/connection/qr';
import { describeConnection } from '@/lib/connection/status';
import { useConnection } from '@/lib/connection/useConnection';
import { useTheme } from '@/theme/ThemeProvider';

import { CertificateHelp } from '../components/CertificateHelp';
import { SetupQrScanner } from '../components/SetupQrScanner';

/**
 * Longer than the background probe's 1.5s: someone is waiting on purpose, and
 * a phone that just joined the Wi-Fi can be slow to its first answer.
 */
const CONNECT_TIMEOUT_MS = 6000;

type Failure =
  | { reason: ProbeFailure | 'not-paired'; target: StoreServerAddress }
  | { reason: 'bad-qr' | 'bad-address' };

function failureText(failure: Failure): string {
  const where = 'target' in failure ? serverLabel(failure.target.baseUrl) : '';
  switch (failure.reason) {
    case 'bad-qr':
      return 'This QR code is not from a TapNtrade store server.';
    case 'bad-address':
      return 'Type the address shown on the cashier PC, like 192.168.1.20.';
    case 'timeout':
    case 'unreachable':
      return `Can't reach ${where}. Check this phone is on the shop Wi-Fi and the cashier PC is on.`;
    case 'not-store':
      return `${where} is not a TapNtrade store server.`;
    case 'wrong-store':
      return 'This store server belongs to another shop.';
    case 'not-paired':
      return 'This store server is not set up yet. Finish the setup on the cashier PC first.';
    case 'untrusted':
      return '';
  }
}

/**
 * Pair this phone with the shop's store server — the TapNtrade server on the
 * cashier PC, which keeps the shop working when the internet is down.
 *
 * Reached from Login (staff must pair before they can sign in: the cloud
 * refuses them once the shop runs on a store server) and from Settings.
 *
 * The address comes from the setup QR on the cashier PC, or is typed by hand.
 * Either way it is checked first — it must be a TapNtrade store server, and
 * this store's — before it is saved and before any password is sent to it.
 */
export function ConnectStoreServerScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();
  const { mode, registered, storeHealth, localStatus, baseUrl, recheck } = useConnection();

  const [scanning, setScanning] = useState(false);
  const [address, setAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);

  // The camera reports the same code many times a second.
  const lastScan = useRef<string | null>(null);
  const busy = useRef(false);

  const connect = async (target: StoreServerAddress) => {
    if (busy.current) return;
    busy.current = true;
    setScanning(false);
    setFailure(null);
    setChecking(true);

    try {
      // Signed in, the phone may only pair with its own store's server.
      if (user?.storeId && target.storeId && target.storeId !== user.storeId) {
        setFailure({ reason: 'wrong-store', target });
        return;
      }
      const storeId = user?.storeId ?? target.storeId;

      const result = await checkStoreServer(target.baseUrl, {
        timeoutMs: CONNECT_TIMEOUT_MS,
        storeId,
      });
      if (!result.ok) {
        setFailure({ reason: result.reason, target });
        return;
      }

      const pairedStoreId = result.health.storeId ?? storeId;
      if (!pairedStoreId) {
        setFailure({ reason: 'not-paired', target });
        return;
      }

      // Addresses learned earlier only carry over for the same machine.
      const sameServer =
        !!registered?.serverId && registered.serverId === result.health.serverId;
      await connectToStoreServer(
        {
          serverId: result.health.serverId ?? undefined,
          storeId: pairedStoreId,
          baseUrl: result.baseUrl,
          lanUrls: sameServer && registered ? registered.lanUrls : [],
          caSha256: result.health.caSha256 ?? target.caSha256 ?? undefined,
        },
        result.health,
      );

      if (!user) {
        // Login now says it is signing in on the store server.
        if (navigation.canGoBack()) navigation.goBack();
      } else if (apiClient.getToken()) {
        toast.success('Connected to the store server');
        if (navigation.canGoBack()) navigation.goBack();
      } else {
        // Sessions are per server. AuthProvider is already swapping to Login.
        toast.info('Sign in once on the store server');
      }
    } finally {
      busy.current = false;
      setChecking(false);
    }
  };

  const onScanned = (data: string) => {
    if (busy.current || data === lastScan.current) return;
    lastScan.current = data;
    const qr = parseSetupQr(data);
    if (!qr) {
      // Keep the camera open: the next code it sees may be the right one.
      setFailure({ reason: 'bad-qr' });
      return;
    }
    void connect(qr);
  };

  const onConnectTyped = () => {
    const target = parseServerAddress(address);
    if (!target) {
      setFailure({ reason: 'bad-address' });
      return;
    }
    void connect(target);
  };

  const retry = () => {
    if (failure && 'target' in failure) void connect(failure.target);
  };

  const onRecheck = async () => {
    setRechecking(true);
    try {
      await recheck();
    } finally {
      setRechecking(false);
    }
  };

  const status = describeConnection({ mode, health: storeHealth, status: localStatus });

  return (
    <Screen scrollable>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ gap: theme.spacing['2xl'] }}
      >
        {registered ? (
          <Card padding="xl" style={{ gap: theme.spacing.lg }}>
            <View style={[styles.row, { gap: theme.spacing.md }]}>
              <Server
                size={20}
                color={mode === 'unreachable' ? theme.colors.destructive : theme.colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodySemibold">
                  {mode === 'cloud' ? 'Using the cloud now' : 'This phone uses the store server'}
                </Text>
                <Text variant="small" color="mutedForeground" style={{ marginTop: theme.spacing.xxs }}>
                  {mode === 'cloud'
                    ? `The store server (${serverLabel(registered.baseUrl)}) is used when this phone is in the shop.`
                    : status?.text.replace(/^Store server · /, '') ?? serverLabel(baseUrl)}
                </Text>
                {mode !== 'cloud' ? (
                  <Text variant="caption" color="mutedForeground" style={{ marginTop: theme.spacing.xxs }}>
                    {serverLabel(mode === 'store' ? baseUrl : registered.baseUrl)}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.buttons, { gap: theme.spacing.sm }]}>
              <Button
                label={rechecking ? 'Checking…' : 'Check again'}
                variant="outline"
                size="sm"
                loading={rechecking}
                icon={rechecking ? undefined : <RefreshCw size={16} color={theme.colors.foreground} />}
                onPress={onRecheck}
                style={{ flex: 1 }}
              />
              <Button
                label="Forget"
                variant="outline"
                size="sm"
                icon={<Trash2 size={16} color={theme.colors.destructive} />}
                onPress={() => setConfirmForget(true)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        <Card padding="xl" style={{ gap: theme.spacing.lg }}>
          <View>
            <Text variant="bodySemibold">
              {registered ? 'Connect again' : 'Connect to the store server'}
            </Text>
            <Text variant="small" color="mutedForeground" style={{ marginTop: theme.spacing.xxs }}>
              The store server is the TapnTrade program on the cashier PC. It keeps the shop working
              without internet. On the PC, open it to see its QR code.
            </Text>
          </View>

          {scanning ? (
            <View style={{ gap: theme.spacing.md }}>
              <SetupQrScanner onScan={onScanned} />
              <Button
                label="Close camera"
                variant="outline"
                fullWidth
                icon={<X size={16} color={theme.colors.foreground} />}
                onPress={() => setScanning(false)}
              />
            </View>
          ) : (
            <Button
              label="Scan QR code"
              fullWidth
              size="lg"
              disabled={checking}
              icon={<QrCode size={18} color="#FFFFFF" />}
              onPress={() => {
                lastScan.current = null;
                setFailure(null);
                setScanning(true);
              }}
            />
          )}

          <Text variant="caption" color="mutedForeground" align="center">
            or type the address
          </Text>

          <Input
            label="Store server address"
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              if (failure?.reason === 'bad-address') setFailure(null);
            }}
            placeholder="192.168.1.20"
            hint="Shown on the cashier PC, under the QR code."
            keyboardType={Platform.OS === 'ios' ? 'url' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={onConnectTyped}
            leading={<Keyboard size={16} color={theme.colors.mutedForeground} />}
          />

          <Button
            label={checking ? 'Checking…' : 'Connect'}
            variant="secondary"
            fullWidth
            loading={checking}
            disabled={checking || address.trim().length === 0}
            onPress={onConnectTyped}
          />

          {failure && failure.reason !== 'untrusted' ? (
            <Text variant="small" color="destructive">
              {failureText(failure)}
            </Text>
          ) : null}
        </Card>

        {failure && failure.reason === 'untrusted' && 'target' in failure ? (
          <CertificateHelp
            setupUrl={failure.target.setupUrl}
            caSha256={failure.target.caSha256 ?? registered?.caSha256}
            onRetry={retry}
            retrying={checking}
          />
        ) : null}
      </KeyboardAvoidingView>

      <ConfirmDialog
        open={confirmForget}
        title="Forget the store server?"
        description="This phone will use the cloud only. Staff phones need the store server to sign in while the shop runs on it."
        confirmLabel="Forget"
        declineLabel="Keep"
        onConfirm={async () => {
          setConfirmForget(false);
          setFailure(null);
          await forgetStoreServer();
          toast.success('Using the cloud');
        }}
        onDecline={() => setConfirmForget(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  buttons: { flexDirection: 'row' },
});
