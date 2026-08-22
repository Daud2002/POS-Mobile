import { Platform } from 'react-native';

import { TransportKind } from '../types';
import { BleTransport } from './BleTransport';
import { BluetoothClassicTransport } from './BluetoothClassicTransport';
import { MockTransport } from './MockTransport';
import { PrinterTransport } from './types';

export { BleTransport } from './BleTransport';
export { BluetoothClassicTransport } from './BluetoothClassicTransport';
export { MockTransport } from './MockTransport';
export { PrinterError } from './types';
export type { PrinterTransport } from './types';

/**
 * One long-lived instance per transport. Bluetooth stacks are stateful — a
 * fresh BleManager per call leaks native resources and drops connections.
 */
const registry: Record<TransportKind, PrinterTransport> = {
  'bt-classic': new BluetoothClassicTransport(),
  ble: new BleTransport(),
  mock: new MockTransport(),
};

export function getTransport(kind: TransportKind): PrinterTransport {
  return registry[kind];
}

export interface TransportOption {
  kind: TransportKind;
  label: string;
  description: string;
  supported: boolean;
}

/**
 * The transports offered on the Printer Setup screen.
 *
 * Bluetooth Classic is hidden on iOS rather than shown-and-failing, because the
 * limitation is Apple's MFi requirement and no amount of retrying will help.
 */
export function availableTransports(includeMock = __DEV__): TransportOption[] {
  const options: TransportOption[] = [
    {
      kind: 'bt-classic',
      label: 'Bluetooth Classic',
      description: 'Most 58mm and 80mm receipt printers. Pair in system settings first.',
      supported: Platform.OS === 'android',
    },
    {
      kind: 'ble',
      label: 'Bluetooth LE',
      description: 'Newer printers. The only Bluetooth option on iOS.',
      // Browsers have no usable path to an ESC/POS printer — see the .web.ts stubs.
      supported: Platform.OS !== 'web',
    },
  ];

  if (includeMock) {
    options.push({
      kind: 'mock',
      label: 'Simulated printer',
      description: 'Development only — prints the receipt to the console.',
      supported: true,
    });
  }

  return options;
}
