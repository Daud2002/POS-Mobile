import { PrinterDevice, TransportKind } from '../types';

export class PrinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrinterError';
  }
}

/**
 * A way to get bytes to a printer.
 *
 * Everything above this interface — the ESC/POS builder, the receipt template —
 * is transport-agnostic and pure. Swapping Bluetooth Classic for BLE or a
 * network socket touches only this layer.
 *
 * Implementations own their own chunking: cheap thermal printers have small
 * receive buffers and silently drop characters if a whole receipt is written at
 * once, so `write` must split and pace the payload.
 */
export interface PrinterTransport {
  readonly kind: TransportKind;

  /** False when the platform cannot support it — e.g. Classic SPP on iOS. */
  isSupported(): boolean;

  /** Requests the OS permissions this transport needs. */
  requestPermissions(): Promise<boolean>;

  /** Scans for candidate printers. */
  discover(timeoutMs?: number): Promise<PrinterDevice[]>;

  connect(device: PrinterDevice): Promise<void>;

  isConnected(): Promise<boolean>;

  write(bytes: Uint8Array): Promise<void>;

  disconnect(): Promise<void>;
}

/** Pauses between chunked writes so the printer's buffer can drain. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Splits a payload into fixed-size chunks.
 *
 * This is the single most important detail in Bluetooth printing. Writing a
 * 2 KB receipt in one call appears to work in testing with short receipts and
 * then drops characters mid-page on a real 30-item sale.
 */
export function chunkBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return chunks;
}

/** Base64-encodes bytes — the wire format both BT libraries expect. */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    output += CHARS[b0 >> 2];
    output += CHARS[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    output += b1 === undefined ? '=' : CHARS[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    output += b2 === undefined ? '=' : CHARS[b2 & 0x3f];
  }

  return output;
}
