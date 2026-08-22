import { create } from 'zustand';

import { StorageKey, storage } from '@/lib/storage';

import {
  charsPerLineFor,
  DEFAULT_PRINTER_PROFILE,
  PaperWidth,
  PrinterConnectionState,
  PrinterDevice,
  PrinterProfile,
} from '../types';

interface PrinterState {
  profile: PrinterProfile;
  connection: PrinterConnectionState;
  /** Last error, shown on the setup screen so failures are diagnosable. */
  lastError: string | null;

  setDevice: (device: PrinterDevice | null) => void;
  setPaperWidth: (width: PaperWidth) => void;
  updateProfile: (patch: Partial<PrinterProfile>) => void;
  setConnection: (state: PrinterConnectionState) => void;
  setLastError: (message: string | null) => void;
}

function loadProfile(): PrinterProfile {
  const stored = storage.getObject<Partial<PrinterProfile>>(StorageKey.printerProfile);
  // Merged rather than replaced so a profile saved by an older build still
  // works after new settings are added.
  return { ...DEFAULT_PRINTER_PROFILE, ...(stored ?? {}) };
}

function persist(profile: PrinterProfile): void {
  storage.setObject(StorageKey.printerProfile, profile);
}

/**
 * Printer selection and settings.
 *
 * Deliberately device-local (MMKV), not server state: `store.printerConfig`
 * holds a Windows printer name for QZ Tray and says nothing about which
 * physical printer THIS phone is paired with.
 */
export const usePrinterStore = create<PrinterState>((set, get) => ({
  profile: loadProfile(),
  connection: 'disconnected',
  lastError: null,

  setDevice: (device) => {
    const profile = { ...get().profile, device };
    persist(profile);
    set({ profile, connection: device ? get().connection : 'disconnected' });
  },

  setPaperWidth: (paperWidth) => {
    // charsPerLine is derived, so the two can never disagree.
    const profile = {
      ...get().profile,
      paperWidth,
      charsPerLine: charsPerLineFor(paperWidth),
    };
    persist(profile);
    set({ profile });
  },

  updateProfile: (patch) => {
    const profile = { ...get().profile, ...patch };
    persist(profile);
    set({ profile });
  },

  setConnection: (connection) => set({ connection }),
  setLastError: (lastError) => set({ lastError }),
}));
