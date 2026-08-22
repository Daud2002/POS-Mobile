import { PrinterDevice, TransportKind } from '../types';
import { PrinterError, PrinterTransport } from './types';

/**
 * Web stub for BLE.
 *
 * Metro resolves `.web.ts` ahead of `.ts` on web, keeping `react-native-ble-plx`
 * — which has no web build — out of the browser bundle.
 *
 * Browsers do expose Web Bluetooth, but it needs a user gesture per connection,
 * is unavailable in Safari and Firefox, and only works over HTTPS. Not worth
 * wiring up for what is a UI preview; use the simulated printer instead.
 */
export class BleTransport implements PrinterTransport {
  readonly kind: TransportKind = 'ble';

  isSupported(): boolean {
    return false;
  }

  async requestPermissions(): Promise<boolean> {
    return false;
  }

  async discover(): Promise<PrinterDevice[]> {
    throw new PrinterError(
      'Bluetooth printing is not available in a browser. Use the mobile app.',
    );
  }

  async connect(): Promise<void> {
    throw new PrinterError(
      'Bluetooth printing is not available in a browser. Use the mobile app.',
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

  destroy(): void {
    // No native manager to release.
  }
}
