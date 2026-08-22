import { PrinterDevice, TransportKind } from '../types';
import { PrinterError, PrinterTransport } from './types';

/**
 * Web stub for Bluetooth Classic.
 *
 * Metro resolves `.web.ts` ahead of `.ts` on the web platform, so the native
 * `react-native-bluetooth-classic` module is never imported in a browser build —
 * it has no web implementation and would fail at import time.
 *
 * Browsers have no Bluetooth Classic API at all (Web Bluetooth is BLE-only and
 * cannot reach SPP printers), so every method reports unsupported rather than
 * pretending to work.
 */
export class BluetoothClassicTransport implements PrinterTransport {
  readonly kind: TransportKind = 'bt-classic';

  isSupported(): boolean {
    return false;
  }

  async requestPermissions(): Promise<boolean> {
    return false;
  }

  async discover(): Promise<PrinterDevice[]> {
    throw new PrinterError(
      'Bluetooth printing is not available in a browser. Use the Android app.',
    );
  }

  async connect(): Promise<void> {
    throw new PrinterError(
      'Bluetooth printing is not available in a browser. Use the Android app.',
    );
  }

  async isConnected(): Promise<boolean> {
    return false;
  }

  async write(): Promise<void> {
    throw new PrinterError('Bluetooth printing is not available in a browser.');
  }

  async disconnect(): Promise<void> {
    // Nothing to disconnect.
  }
}
