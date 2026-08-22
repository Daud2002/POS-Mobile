import { decodePrintable } from '../templates/receipt.template';
import { PrinterDevice, TransportKind } from '../types';
import { chunkBytes, delay, PrinterTransport } from './types';

/**
 * A printer that only exists in the console.
 *
 * This is what makes the whole printing stack testable before any hardware
 * arrives: it logs the byte count, the chunk boundaries, and the decoded
 * receipt text, so layout can be iterated on a simulator.
 */
export class MockTransport implements PrinterTransport {
  readonly kind: TransportKind = 'mock';

  private connected = false;
  private device: PrinterDevice | null = null;

  /** The bytes of the last job, for assertions in tests. */
  lastPayload: Uint8Array | null = null;

  isSupported(): boolean {
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  async discover(): Promise<PrinterDevice[]> {
    // A short delay so the UI's scanning state is visible in development.
    await delay(400);
    return [
      { id: 'mock-58', name: 'Mock Printer (58mm)', kind: 'mock' },
      { id: 'mock-80', name: 'Mock Printer (80mm)', kind: 'mock' },
    ];
  }

  async connect(device: PrinterDevice): Promise<void> {
    await delay(200);
    this.device = device;
    this.connected = true;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.lastPayload = bytes;
    const chunks = chunkBytes(bytes, 180);

    console.log(
      `[MockPrinter] ${this.device?.name ?? 'unknown'} — ${bytes.length} bytes in ${chunks.length} chunks`,
    );
    console.log(`[MockPrinter] receipt:\n${decodePrintable(bytes)}`);

    // Paced like a real transport so timing bugs surface here too.
    for (const _chunk of chunks) {
      await delay(5);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.device = null;
  }
}
