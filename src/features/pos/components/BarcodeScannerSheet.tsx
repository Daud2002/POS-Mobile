import { CameraView, useCameraPermissions } from 'expo-camera';
import { Keyboard, ScanLine } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface BarcodeScannerSheetProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

/** Barcode symbologies a retail POS actually encounters. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

/** Ignore repeat reads of the same code while the camera keeps decoding it. */
const RESCAN_COOLDOWN_MS = 1500;

/**
 * Barcode entry — camera scanning, with manual entry as a fallback.
 *
 * The web POS uses a hidden autofocused input as a keyboard wedge for USB
 * scanners. On mobile the camera is the primary scanner, and the manual field
 * covers both damaged labels and stores using a paired hardware scanner.
 */
export function BarcodeScannerSheet({ open, onClose, onScan }: BarcodeScannerSheetProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();

  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const handleScanned = (code: string) => {
    const now = Date.now();
    const previous = lastScan.current;

    if (previous && previous.code === code && now - previous.at < RESCAN_COOLDOWN_MS) {
      return;
    }

    lastScan.current = { code, at: now };
    onScan(code);
  };

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    onScan(code);
    setManualCode('');
    onClose();
  };

  const showCamera = open && !manualEntry && permission?.granted;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Scan Barcode"
      description="Point the camera at the product barcode"
      scrollable={false}
      maxHeightRatio={0.8}
    >
      <View style={{ flex: 1, gap: theme.spacing.lg }}>
        {manualEntry ? (
          <View style={{ gap: theme.spacing.lg }}>
            <Input
              label="Barcode"
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="e.g. 123456789012"
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitManual}
            />
            <Button label="Add Product" onPress={submitManual} fullWidth size="lg" />
          </View>
        ) : !permission ? (
          <Text variant="small" color="mutedForeground">
            Checking camera permission…
          </Text>
        ) : !permission.granted ? (
          <View style={{ gap: theme.spacing.lg }}>
            <Text variant="small" color="mutedForeground">
              Camera access is needed to scan barcodes. You can also type the barcode
              in by hand.
            </Text>
            <Button label="Allow Camera" onPress={requestPermission} fullWidth />
          </View>
        ) : (
          <View
            style={[
              styles.cameraFrame,
              { borderRadius: theme.radius.lg, borderColor: theme.colors.border },
            ]}
          >
            {showCamera ? (
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                onBarcodeScanned={({ data }) => handleScanned(data)}
              />
            ) : null}

            <View style={styles.reticle} pointerEvents="none">
              <ScanLine size={48} color="#FFFFFF" />
            </View>
          </View>
        )}

        <Button
          label={manualEntry ? 'Use Camera' : 'Enter Barcode Manually'}
          variant="outline"
          fullWidth
          icon={<Keyboard size={16} color={theme.colors.foreground} />}
          onPress={() => setManualEntry((manual) => !manual)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cameraFrame: {
    flex: 1,
    minHeight: 240,
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
