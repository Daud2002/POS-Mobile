import { Platform } from 'react-native';
import RNBluetoothClassic, {
  BluetoothDevice,
} from 'react-native-bluetooth-classic';

import { requestBluetoothPermissions } from '@/lib/permissions';

import { PrinterDevice, TransportKind } from '../types';
import { bytesToBase64, chunkBytes, delay, PrinterError, PrinterTransport } from './types';

/** SPP sockets accept larger writes than BLE, but cheap printers still overrun. */
const CHUNK_SIZE = 512;
const CHUNK_DELAY_MS = 12;

/**
 * Bluetooth Classic (SPP / RFCOMM) — the transport almost every cheap 58/80 mm
 * ESC/POS printer speaks (Xprinter, Goojprt, BP-80 clones).
 *
 * ANDROID ONLY. iOS cannot open an SPP socket to a non-MFi accessory: Apple
 * requires the printer to be MFi-certified and the app to declare its protocol
 * string in UISupportedExternalAccessoryProtocols. Generic thermal printers are
 * not certified, so on iOS this transport reports itself unsupported and the UI
 * offers BLE instead.
 */
export class BluetoothClassicTransport implements PrinterTransport {
  readonly kind: TransportKind = 'bt-classic';

  private device: BluetoothDevice | null = null;

  isSupported(): boolean {
    return Platform.OS === 'android';
  }

  async requestPermissions(): Promise<boolean> {
    const result = await requestBluetoothPermissions();
    if (!result.granted) throw new PrinterError(result.message ?? 'Permission denied');
    return true;
  }

  /**
   * Returns PAIRED devices, not a live radio scan.
   *
   * SPP printers must be paired at OS level before an app can open a socket, so
   * discovery here means "which paired devices could be a printer" — pairing
   * itself happens in Android's Bluetooth settings.
   */
  async discover(): Promise<PrinterDevice[]> {
    if (!this.isSupported()) {
      throw new PrinterError('Bluetooth Classic printing is only available on Android.');
    }

    await this.requestPermissions();

    const available = await RNBluetoothClassic.isBluetoothAvailable();
    if (!available) throw new PrinterError('This device has no Bluetooth adapter.');

    const enabled = await RNBluetoothClassic.isBluetoothEnabled();
    if (!enabled) {
      // Raises the system "turn on Bluetooth" dialog rather than just failing.
      const turnedOn = await RNBluetoothClassic.requestBluetoothEnabled();
      if (!turnedOn) throw new PrinterError('Bluetooth is turned off.');
    }

    const bonded = await RNBluetoothClassic.getBondedDevices();

    return bonded.map((device) => ({
      id: device.address,
      name: device.name || device.address,
      kind: 'bt-classic' as const,
      paired: true,
    }));
  }

  async connect(target: PrinterDevice): Promise<void> {
    if (!this.isSupported()) {
      throw new PrinterError('Bluetooth Classic printing is only available on Android.');
    }

    await this.requestPermissions();

    // Reuse an existing socket rather than stacking connections.
    const alreadyConnected = await RNBluetoothClassic.isDeviceConnected(target.id);
    if (alreadyConnected) {
      this.device = await RNBluetoothClassic.getConnectedDevice(target.id);
      return;
    }

    try {
      this.device = await RNBluetoothClassic.connectToDevice(target.id, {
        connectorType: 'rfcomm',
        // Printers are write-only for our purposes; a delimiter would leave the
        // read thread buffering forever waiting for a newline that never comes.
        delimiter: '',
        secureSocket: false,
      });
    } catch (error) {
      throw new PrinterError(
        `Could not connect to ${target.name}. Make sure it is switched on and paired.`,
      );
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.device) return false;
    try {
      return await RNBluetoothClassic.isDeviceConnected(this.device.address);
    } catch {
      return false;
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.device) throw new PrinterError('No printer connected.');

    // Base64 is the only encoding that survives the JS bridge intact — the
    // 'ascii' path mangles any byte above 0x7F, which includes every ESC/POS
    // command parameter and every CP437 glyph.
    for (const chunk of chunkBytes(bytes, CHUNK_SIZE)) {
      const ok = await this.device.write(bytesToBase64(chunk), 'base64');
      if (!ok) throw new PrinterError('The printer rejected the data.');
      await delay(CHUNK_DELAY_MS);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.device) return;
    try {
      await RNBluetoothClassic.disconnectFromDevice(this.device.address);
    } catch {
      // Already gone — nothing to clean up.
    } finally {
      this.device = null;
    }
  }
}
