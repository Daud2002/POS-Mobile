import { formatCurrency } from '@/lib/currencies';
import { receiptDate, timeLabel } from '@/lib/date';
import { orderNumberLabel } from '@/lib/format';

import { Column, EscPosBuilder } from '../escpos/builder';
import { PrinterProfile } from '../types';

/**
 * Everything a receipt needs, decoupled from both the API shape and cart state.
 *
 * The web app builds its receipt directly from live cart state, which means
 * printed totals can disagree with what the server saved, and a receipt can
 * never be reprinted once the cart is cleared. Mobile assembles this from the
 * order the API returned (or from GET /invoices/:orderId for a reprint), so the
 * paper always matches the database and reprints are possible.
 */
export interface ReceiptData {
  store: {
    name: string;
    address?: string;
    phone?: string;
  };
  invoiceNumber: string;
  /** Order creation time — not "now", so reprints show the original sale time. */
  date: Date;
  customerName?: string;
  /** 'Store Owner' or the employee's name. */
  dispatchedBy: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    /** Line total discount. */
    discount: number;
    total: number;
  }>;
  /** Σ price × qty, before discounts — matches what the web receipt prints. */
  rawSubtotal: number;
  totalDiscount: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  currency: string;
  /** Marks a reprint so duplicates are distinguishable from the original. */
  isReprint?: boolean;
}

/** Column widths for the item table, derived from the paper width. */
function itemColumns(charsPerLine: number): {
  name: number;
  qty: number;
  amount: number;
} {
  // 58 mm (32 cols): 16 / 5 / 11 — the exact layout the web app uses.
  if (charsPerLine <= 32) return { name: 16, qty: 5, amount: 11 };
  // 80 mm (48 cols): more room for the product name.
  return { name: 28, qty: 6, amount: 14 };
}

/**
 * Renders a receipt to ESC/POS bytes.
 *
 * Pure and side-effect free — this is what makes the layout unit-testable and
 * lets the on-screen preview show exactly what will print.
 */
export function buildReceipt(data: ReceiptData, profile: PrinterProfile): Uint8Array {
  const builder = new EscPosBuilder({
    charsPerLine: profile.charsPerLine,
    codepage: profile.codepage,
  });

  const money = (amount: number) => formatCurrency(amount, data.currency);
  const cols = itemColumns(profile.charsPerLine);

  builder.init();

  // --- Header -------------------------------------------------------------
  builder.align('center').bold(true).size(2, 2);
  builder.line(data.store.name.toUpperCase());
  builder.size(1, 1).bold(false);

  if (data.store.address) builder.wrapped(data.store.address);
  if (data.store.phone) builder.line(`Tel: ${data.store.phone}`);

  if (data.isReprint) {
    builder.newline().bold(true).line('*** REPRINT ***').bold(false);
  }

  builder.align('left').newline();

  // --- Order meta ---------------------------------------------------------
  builder.divider();
  builder.row('INVOICE #:', orderNumberLabel(data.invoiceNumber));
  builder.row('DATE:', `${receiptDate(data.date)} ${timeLabel(data.date)}`);
  builder.row('CUSTOMER:', data.customerName || 'Walk-in');
  builder.row('DISPATCH BY:', data.dispatchedBy);
  builder.divider();

  // --- Items --------------------------------------------------------------
  builder.columns([
    { text: 'ITEM', width: cols.name },
    { text: 'QTY', width: cols.qty },
    { text: 'AMOUNT', width: cols.amount, align: 'right' },
  ]);
  builder.divider();

  for (const item of data.items) {
    const lineTotal = item.unitPrice * item.quantity;

    // Long names wrap onto continuation lines instead of being truncated to
    // 15 characters the way the web version does.
    const [firstLine, ...restLines] = wrapName(item.name, cols.name);

    const row: Column[] = [
      { text: firstLine, width: cols.name },
      { text: String(item.quantity), width: cols.qty },
      { text: money(lineTotal), width: cols.amount, align: 'right' },
    ];
    builder.columns(row);

    for (const continuation of restLines) {
      builder.columns([{ text: continuation, width: cols.name }]);
    }

    if (item.discount > 0) {
      builder.columns([
        { text: '  less discount', width: cols.name + cols.qty },
        { text: `-${money(item.discount)}`, width: cols.amount, align: 'right' },
      ]);
    }
  }

  // --- Totals -------------------------------------------------------------
  builder.divider();
  builder.row('SUBTOTAL:', money(data.rawSubtotal));

  if (data.totalDiscount > 0) {
    builder.row('DISCOUNT:', `- ${money(data.totalDiscount)}`);
  }

  // Tax is 0 on web (the 8% line is commented out) and is never printed there.
  // Printing it only when non-zero keeps parity while supporting real tax.
  if (data.tax > 0) {
    builder.row('TAX:', money(data.tax));
  }

  builder.bold(true).size(1, 2);
  builder.row('TOTAL:', money(data.total));
  builder.size(1, 1).bold(false);

  if (data.paymentMethod) {
    builder.row('PAYMENT:', data.paymentMethod.toUpperCase());
  }

  builder.divider();

  // --- Footer -------------------------------------------------------------
  builder.newline().align('center');
  builder.line('** THANK YOU! **');
  builder.line('Visit Again :)');
  builder.newline();
  builder.line('tapntrade.store');
  builder.align('left');

  builder.feed(profile.autoCut ? 3 : 5);
  if (profile.autoCut) builder.cut();
  if (profile.openCashDrawer) builder.openCashDrawer();

  return builder.build();
}

/** Word-wraps a product name to the item column width. */
function wrapName(name: string, width: number): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > width ? word.slice(0, width) : word;
    }
  }
  if (current) lines.push(current);

  return lines.length > 0 ? lines : [''];
}

/**
 * Renders the receipt as plain text at the given width.
 *
 * Used by the on-screen preview so the cashier sees the real column alignment
 * without needing hardware, and by tests.
 */
export function renderReceiptText(data: ReceiptData, profile: PrinterProfile): string {
  const bytes = buildReceipt(data, profile);
  return decodePrintable(bytes);
}

/**
 * Strips ESC/POS control sequences and decodes the remaining text, so a byte
 * stream can be shown as the human-readable receipt it represents.
 */
export function decodePrintable(bytes: Uint8Array): string {
  let out = '';
  let i = 0;

  while (i < bytes.length) {
    const byte = bytes[i];

    // ESC (0x1B) sequences.
    if (byte === 0x1b) {
      const command = bytes[i + 1];
      // ESC @ (init) and ESC 2 take no parameter.
      if (command === 0x40 || command === 0x32) {
        i += 2;
        continue;
      }
      // ESC d n — feed n lines.
      if (command === 0x64) {
        out += '\n'.repeat(bytes[i + 2] ?? 0);
        i += 3;
        continue;
      }
      // ESC p — cash drawer, 4 parameter bytes after the command.
      if (command === 0x70) {
        i += 5;
        continue;
      }
      // ESC a/E/-/t/3 — one parameter byte.
      i += 3;
      continue;
    }

    // GS (0x1D) sequences.
    if (byte === 0x1d) {
      const command = bytes[i + 1];
      // GS V m n — cut, two parameter bytes.
      if (command === 0x56) {
        i += 4;
        continue;
      }
      // GS ! n — one parameter byte.
      i += 3;
      continue;
    }

    out += String.fromCharCode(byte);
    i += 1;
  }

  return out;
}
