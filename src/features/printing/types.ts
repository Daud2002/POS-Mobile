import { CodepageValue } from './escpos/commands';

export type TransportKind = 'bt-classic' | 'ble' | 'mock';

export interface PrinterDevice {
  /** MAC address (Classic), peripheral UUID (BLE), or a synthetic id (mock). */
  id: string;
  name: string;
  kind: TransportKind;
  /** BLE signal strength, when the transport reports it. */
  rssi?: number;
  /** Classic only — whether the device is already paired at OS level. */
  paired?: boolean;
}

export type PaperWidth = 58 | 80;

/**
 * Per-device printer configuration.
 *
 * This deliberately does NOT come from the backend. `store.printerConfig` holds
 * a Windows printer name ("BP-80") for QZ Tray, which is meaningless on a
 * phone, and it is editable only from the super-admin panel — which the mobile
 * app does not include. Which physical printer a device is paired with is a
 * property of that device, so it lives in MMKV.
 */
export interface PrinterProfile {
  device: PrinterDevice | null;
  paperWidth: PaperWidth;
  /** 58 mm → 32 columns, 80 mm → 48. Derived from paperWidth but overridable. */
  charsPerLine: number;
  codepage: CodepageValue;
  autoCut: boolean;
  openCashDrawer: boolean;
  copies: number;
}

/** Characters per line for a paper width, using the Font A convention. */
export function charsPerLineFor(paperWidth: PaperWidth): number {
  return paperWidth === 58 ? 32 : 48;
}

export const DEFAULT_PRINTER_PROFILE: PrinterProfile = {
  device: null,
  // Defaults to 80 mm because the store default printer is "BP-80", an 80 mm
  // model. The web app hardcodes 32 columns regardless, so today's receipts
  // print two-thirds width on that hardware.
  paperWidth: 80,
  charsPerLine: 48,
  codepage: 0, // CP437
  autoCut: true,
  openCashDrawer: false,
  copies: 1,
};

export type PrinterConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'printing';

/** A print attempt's outcome. Printing never blocks a sale — see usePrinter. */
export interface PrintResult {
  ok: boolean;
  error?: string;
}
