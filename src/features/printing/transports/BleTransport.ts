import { BleManager, Characteristic, Device, State } from 'react-native-ble-plx';
import { Platform } from 'react-native';

import { requestBluetoothPermissions } from '@/lib/permissions';

import { PrinterDevice, TransportKind } from '../types';
import { bytesToBase64, chunkBytes, delay, PrinterError, PrinterTransport } from './types';

/**
 * Fallback chunk size when MTU negotiation is unavailable. 180 is below the
 * 185-byte payload of the common 244-byte MTU and safe on the default 23.
 */
const FALLBACK_CHUNK = 180;
const CHUNK_DELAY_MS = 20;
const DEFAULT_SCAN_MS = 8000;

/**
 * BLE (GATT) transport — the only Bluetooth path that works on BOTH platforms.
 *
 * Newer and dual-mode thermal printers expose a writable characteristic that
 * accepts raw ESC/POS. iOS can talk to these without MFi certification, which
 * is what makes cross-platform printing possible at all.
 *
 * Printers do not advertise a standard service UUID, so rather than filter by
 * service, this scans broadly and then looks for any writable characteristic on
 * the connected device.
 */
export class BleTransport implements PrinterTransport {
  readonly kind: TransportKind = 'ble';

  private manager: BleManager | null = null;
  private device: Device | null = null;
  private writeCharacteristic: Characteristic | null = null;
  private chunkSize = FALLBACK_CHUNK;

  /** Created lazily — instantiating BleManager triggers the iOS permission prompt. */
  private getManager(): BleManager {
    if (!this.manager) this.manager = new BleManager();
    return this.manager;
  }

  isSupported(): boolean {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }

  async requestPermissions(): Promise<boolean> {
    const result = await requestBluetoothPermissions();
    if (!result.granted) throw new PrinterError(result.message ?? 'Permission denied');
    return true;
  }

  async discover(timeoutMs = DEFAULT_SCAN_MS): Promise<PrinterDevice[]> {
    await this.requestPermissions();

    const manager = this.getManager();

    const state = await manager.state();
    if (state !== State.PoweredOn) {
      throw new PrinterError('Bluetooth is turned off. Switch it on and try again.');
    }

    return new Promise<PrinterDevice[]>((resolve, reject) => {
      const found = new Map<string, PrinterDevice>();

      const finish = () => {
        manager.stopDeviceScan();
        clearTimeout(timer);
        resolve(
          [...found.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)),
        );
      };

      const timer = setTimeout(finish, timeoutMs);

      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          manager.stopDeviceScan();
          clearTimeout(timer);
          reject(new PrinterError(error.message));
          return;
        }

        // Unnamed peripherals are almost never printers and would flood the
        // list with beacons and phones.
        if (!device?.name) return;

        found.set(device.id, {
          id: device.id,
          name: device.name,
          kind: 'ble',
          rssi: device.rssi ?? undefined,
        });
      });
    });
  }

  async connect(target: PrinterDevice): Promise<void> {
    await this.requestPermissions();
    const manager = this.getManager();

    let device: Device;
    try {
      device = await manager.connectToDevice(target.id, { timeout: 10_000 });
    } catch {
      throw new PrinterError(
        `Could not connect to ${target.name}. Make sure it is switched on and nearby.`,
      );
    }

    // A larger MTU means fewer round-trips and a noticeably faster receipt.
    // Android only; iOS negotiates automatically and exposes the result below.
    if (Platform.OS === 'android') {
      try {
        device = await device.requestMTU(512);
      } catch {
        // Not all printers support MTU negotiation — the fallback is fine.
      }
    }

    // ATT overhead is 3 bytes, so the usable payload is mtu - 3.
    const mtu = device.mtu ?? 23;
    this.chunkSize = Math.max(20, Math.min(mtu - 3, FALLBACK_CHUNK * 3));

    await device.discoverAllServicesAndCharacteristics();

    const characteristic = await this.findWritableCharacteristic(device);
    if (!characteristic) {
      await device.cancelConnection();
      throw new PrinterError(
        `${target.name} has no writable Bluetooth channel. It may not be an ESC/POS printer.`,
      );
    }

    this.device = device;
    this.writeCharacteristic = characteristic;
  }

  /**
   * Finds a characteristic we can push bytes to.
   *
   * writeWithoutResponse is preferred — it is markedly faster and printers do
   * not acknowledge anyway — but a plain writable characteristic works too.
   */
  private async findWritableCharacteristic(device: Device): Promise<Characteristic | null> {
    const services = await device.services();
    let fallback: Characteristic | null = null;

    for (const service of services) {
      for (const characteristic of await service.characteristics()) {
        if (characteristic.isWritableWithoutResponse) return characteristic;
        if (characteristic.isWritableWithResponse && !fallback) fallback = characteristic;
      }
    }

    return fallback;
  }

  async isConnected(): Promise<boolean> {
    if (!this.device) return false;
    try {
      return await this.device.isConnected();
    } catch {
      return false;
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    const characteristic = this.writeCharacteristic;
    if (!characteristic) throw new PrinterError('No printer connected.');

    const useWithoutResponse = characteristic.isWritableWithoutResponse;

    // BLE has no flow control here: without both chunking and a pause between
    // chunks, long receipts arrive with characters missing.
    for (const chunk of chunkBytes(bytes, this.chunkSize)) {
      const payload = bytesToBase64(chunk);
      try {
        if (useWithoutResponse) {
          await characteristic.writeWithoutResponse(payload);
        } else {
          await characteristic.writeWithResponse(payload);
        }
      } catch (error) {
        throw new PrinterError('Lost connection to the printer while printing.');
      }
      await delay(CHUNK_DELAY_MS);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.device?.cancelConnection();
    } catch {
      // Already disconnected.
    } finally {
      this.device = null;
      this.writeCharacteristic = null;
    }
  }

  /** Releases the native manager. Call when the app tears down. */
  destroy(): void {
    this.manager?.destroy();
    this.manager = null;
  }
}
