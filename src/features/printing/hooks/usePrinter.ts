import { useCallback, useState } from 'react';

import { usePrinterStore } from '../store/printer.store';
import { buildReceipt, ReceiptData } from '../templates/receipt.template';
import { getTransport, PrinterError } from '../transports';
import { PrinterDevice, PrintResult } from '../types';

/**
 * The printing API used by screens.
 *
 * The contract that matters: `printReceipt` NEVER throws. A print failure
 * returns `{ ok: false, error }` so the caller can toast it and carry on. The
 * web app has the same property (a QZ failure only raises a toast; the order is
 * still saved) and it must be preserved — a dead printer battery must not block
 * a sale.
 */
export function usePrinter() {
  const profile = usePrinterStore((state) => state.profile);
  const connection = usePrinterStore((state) => state.connection);
  const setConnection = usePrinterStore((state) => state.setConnection);
  const setLastError = usePrinterStore((state) => state.setLastError);
  const setDevice = usePrinterStore((state) => state.setDevice);

  const [discovering, setDiscovering] = useState(false);

  const hasPrinter = !!profile.device;

  /** Scans for printers on the given transport. Throws so the UI can show why. */
  const discover = useCallback(async (kind: PrinterDevice['kind']) => {
    setDiscovering(true);
    setLastError(null);
    try {
      return await getTransport(kind).discover();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not scan for printers.';
      setLastError(message);
      throw new PrinterError(message);
    } finally {
      setDiscovering(false);
    }
  }, [setLastError]);

  /** Connects and remembers the device as the active printer. */
  const connect = useCallback(
    async (device: PrinterDevice) => {
      setConnection('connecting');
      setLastError(null);
      try {
        await getTransport(device.kind).connect(device);
        setDevice(device);
        setConnection('connected');
      } catch (error) {
        setConnection('disconnected');
        const message = error instanceof Error ? error.message : 'Could not connect.';
        setLastError(message);
        throw new PrinterError(message);
      }
    },
    [setConnection, setDevice, setLastError],
  );

  const disconnect = useCallback(async () => {
    const device = usePrinterStore.getState().profile.device;
    if (device) await getTransport(device.kind).disconnect();
    setConnection('disconnected');
  }, [setConnection]);

  /**
   * Renders and prints a receipt.
   *
   * Reconnects on demand: Bluetooth sockets drop when the printer sleeps, so
   * requiring a manual reconnect before every sale would be unusable.
   */
  const printReceipt = useCallback(
    async (data: ReceiptData): Promise<PrintResult> => {
      const current = usePrinterStore.getState().profile;

      if (!current.device) {
        return { ok: false, error: 'No printer set up. Add one in Settings › Printer.' };
      }

      const transport = getTransport(current.device.kind);

      try {
        setConnection('printing');

        if (!(await transport.isConnected())) {
          await transport.connect(current.device);
        }

        const bytes = buildReceipt(data, current);
        for (let copy = 0; copy < Math.max(1, current.copies); copy += 1) {
          await transport.write(bytes);
        }

        setConnection('connected');
        setLastError(null);
        return { ok: true };
      } catch (error) {
        setConnection('disconnected');
        const message =
          error instanceof Error ? error.message : 'Receipt printing failed.';
        setLastError(message);
        return { ok: false, error: message };
      }
    },
    [setConnection, setLastError],
  );

  return {
    profile,
    connection,
    hasPrinter,
    discovering,
    discover,
    connect,
    disconnect,
    printReceipt,
  };
}
