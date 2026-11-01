import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { formatFingerprint } from '@/lib/connection/qr';
import { useTheme } from '@/theme/ThemeProvider';

interface CertificateHelpProps {
  /** The setup page on the cashier PC, which offers the certificate download. */
  setupUrl: string;
  /** From the QR or a previous pairing; unknown for a typed address on a new phone. */
  caSha256?: string | null;
  onRetry: () => void;
  retrying?: boolean;
}

const IPHONE_STEPS = [
  'Tap "Open certificate page" below and allow the download.',
  'Open Settings → General → VPN & Device Management. Tap the TapNtrade certificate, then Install.',
  'Open Settings → General → About → Certificate Trust Settings. Turn on the TapNtrade certificate.',
  'Come back here and tap "Try again".',
];

const ANDROID_STEPS = [
  'Tap "Open certificate page" below and download the certificate.',
  'Open Settings → Security → Encryption & credentials → Install a certificate → CA certificate. Pick the file you downloaded.',
  'Come back here and tap "Try again".',
];

/**
 * Shown when the phone could not open a secure connection to the store
 * server, which almost always means the shop certificate isn't installed.
 *
 * The phone has to trust the shop's own certificate authority once; no app
 * can do that for the user, so the best this can do is plain steps. The
 * fingerprint lets an owner check that the certificate they installed is the
 * one the cashier PC shows, not someone else's.
 */
export function CertificateHelp({ setupUrl, caSha256, onRetry, retrying }: CertificateHelpProps) {
  const theme = useTheme();
  const ios = Platform.OS === 'ios';
  const steps = ios ? IPHONE_STEPS : ANDROID_STEPS;
  const fingerprint = formatFingerprint(caSha256);

  return (
    <Card padding="xl" style={{ gap: theme.spacing.lg }}>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <ShieldCheck size={20} color={theme.colors.warning} />
        <View style={{ flex: 1 }}>
          <Text variant="bodySemibold">Install the shop certificate</Text>
          <Text variant="small" color="mutedForeground" style={{ marginTop: theme.spacing.xxs }}>
            This phone does not trust the store server yet. Do this once:
          </Text>
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {steps.map((step, index) => (
          <View key={step} style={[styles.row, { gap: theme.spacing.sm }]}>
            <Text variant="smallMedium" style={styles.number}>
              {index + 1}.
            </Text>
            <Text variant="small" style={{ flex: 1 }}>
              {step}
            </Text>
          </View>
        ))}
        {!ios ? (
          <Text variant="caption" color="mutedForeground">
            Menu names can be a little different on some phones.
          </Text>
        ) : null}
      </View>

      {fingerprint ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="mutedForeground">
            The certificate fingerprint (SHA-256) must match the one on the cashier PC:
          </Text>
          <Text variant="mono" selectable>
            {fingerprint}
          </Text>
        </View>
      ) : null}

      <Text variant="caption" color="mutedForeground">
        {ios
          ? 'Already done? Check this phone is on the shop Wi-Fi, and that Settings → TapnTrade → Local Network is on.'
          : 'Already done? Check this phone is on the shop Wi-Fi.'}
      </Text>

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label="Open certificate page"
          variant="outline"
          fullWidth
          icon={<ExternalLink size={16} color={theme.colors.foreground} />}
          onPress={() => {
            // The phone's browser, not the app: only the browser can hand a
            // certificate to the system installer.
            Linking.openURL(setupUrl).catch(() => undefined);
          }}
        />
        <Button
          label={retrying ? 'Checking…' : 'Try again'}
          fullWidth
          loading={retrying}
          icon={retrying ? undefined : <RefreshCw size={16} color="#FFFFFF" />}
          onPress={onRetry}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  number: { width: 18 },
});
