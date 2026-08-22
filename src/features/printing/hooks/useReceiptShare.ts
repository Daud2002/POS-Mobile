import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { receiptToHtml } from '../pdf/receiptHtml';
import { ReceiptData } from '../templates/receipt.template';
import { PrintResult } from '../types';

/**
 * System print / share for a receipt.
 *
 * This is the escape hatch when there is no Bluetooth printer available — most
 * importantly on iOS, where a Classic (non-MFi) ESC/POS printer simply cannot
 * be reached. AirPrint, "Save to Files", email and messaging all work from here.
 *
 * Like `printReceipt`, neither of these ever throws: they return a result the
 * caller can toast.
 */
export function useReceiptShare() {
  const [busy, setBusy] = useState(false);

  /** Opens the OS print dialog (AirPrint on iOS, print service on Android). */
  const printViaSystem = useCallback(async (data: ReceiptData): Promise<PrintResult> => {
    setBusy(true);
    try {
      await Print.printAsync({ html: receiptToHtml(data) });
      return { ok: true };
    } catch (error) {
      // The user dismissing the print sheet lands here too; treat it as benign.
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not open the print dialog.',
      };
    } finally {
      setBusy(false);
    }
  }, []);

  /** Renders a PDF and opens the share sheet. */
  const shareAsPdf = useCallback(async (data: ReceiptData): Promise<PrintResult> => {
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: receiptToHtml(data) });

      if (!(await Sharing.isAvailableAsync())) {
        return { ok: false, error: 'Sharing is not available on this device.' };
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share receipt',
        UTI: 'com.adobe.pdf',
      });

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not create the PDF.',
      };
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    printViaSystem,
    shareAsPdf,
    busy,
    /** iOS users are the main audience for this, but it works on Android too. */
    isPrimaryFallback: Platform.OS === 'ios',
  };
}
