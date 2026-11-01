import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScanLine } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface SetupQrScannerProps {
  /** Fires for every decoded QR; the caller ignores repeats and bad codes. */
  onScan: (data: string) => void;
}

/**
 * Camera view for the setup QR on the cashier PC. Same camera and permission
 * flow as the POS barcode scanner (BarcodeScannerSheet), limited to QR codes.
 */
export function SetupQrScanner({ onScan }: SetupQrScannerProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return (
      <Text variant="small" color="mutedForeground">
        Checking camera permission…
      </Text>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="small" color="mutedForeground">
          Camera access is needed to scan the QR code. You can also type the address below.
        </Text>
        <Button label="Allow Camera" onPress={requestPermission} fullWidth />
      </View>
    );
  }

  return (
    <View
      style={[styles.frame, { borderRadius: theme.radius.lg, borderColor: theme.colors.border }]}
    >
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <View style={styles.reticle} pointerEvents="none">
        <ScanLine size={48} color="#FFFFFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 260,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#000000',
  },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  reticle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
});
