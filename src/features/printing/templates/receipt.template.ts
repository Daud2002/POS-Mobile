import { formatCurrency } from '@/lib/currencies';
import { receiptDate, timeLabel } from '@/lib/date';
import { orderNumberLabel } from '@/lib/format';

import { EscPosBuilder } from '../escpos/builder';
import { PrinterProfile } from '../types';

import {
  boxRule,
  FrameColumn,
  frameMargin,
  framed,
  receiptStamp,
  tableRow,
  wrapName,
  writeBig,
  writeOrderRow,
  writeSplit,
} from './frame';

export { frameMargin } from './frame';

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
  /**
   * Dine-in / dine-out / takeaway / delivery, already written for people.
   * Printed as its own row so a dine-out bill is distinguishable from a plain
   * dine-in one — which is exactly what the customer is paying for.
   */
  orderTypeLabel?: string;
  /** Table name, when the order is seated. */
  tableName?: string | null;
  /** Printed for the rider on delivery orders. */
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    /** Line total discount. */
    discount: number;
    total: number;
    /** Packed to go, on a dine-out order that also eats in. */
    isParcel?: boolean;
  }>;
  /** Σ price × qty, before discounts — matches what the web receipt prints. */
  rawSubtotal: number;
  totalDiscount: number;
  /** Added on top of the discounted food on a delivery. Printed only when > 0. */
  deliveryCharge?: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  /** The parts of a split payment, each printed on its own line under "Paid by". */
  paymentParts?: Array<{ label: string; amount: number }>;
  currency: string;
  /** Marks a reprint so duplicates are distinguishable from the original. */
  isReprint?: boolean;
}


/**
 * Item-table columns, sized to the FRAME (the paper less its margins) so the
 * vertical rules fit exactly; the item name takes whatever the fixed number
 * columns leave.
 *
 * 58mm paper DROPS the unit-rate column. Squeezing five columns into 30
 * characters leaves the dish name 7 characters and abbreviates the headings to
 * "Rat" and "Amo" — unreadable. The rate is derivable from qty and amount,
 * whereas a mangled dish name is simply lost, so the name wins the space.
 */
function itemColumns(frame: number): { cols: FrameColumn[]; showRate: boolean } {
  if (frame >= 40) {
    // 80 mm, 44 wide: No(3) Item(16) Qty(4) Rate(7) Amount(8) + 6 rules = 44
    return {
      showRate: true,
      cols: [
        { width: 3 },
        { width: frame - 28 },
        { width: 4, align: 'right' },
        { width: 7, align: 'right' },
        { width: 8, align: 'right' },
      ],
    };
  }
  // 58 mm, 30 wide: No(3) Item(11) Qty(4) Amount(7) + 5 rules = 30
  return {
    showRate: false,
    cols: [
      { width: 3 },
      { width: frame - 19 },
      { width: 4, align: 'right' },
      { width: 7, align: 'right' },
    ],
  };
}

/**
 * Money for a narrow table column: grouped, and without the currency symbol,
 * which is stated once in the totals rather than on every line.
 */
function plain(amount: number): string {
  const n = Number(amount) || 0;
  return Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Renders a receipt to ESC/POS bytes.
 *
 * Built as a bordered document rather than a stream of left/right rows: an
 * itemised bill is a TABLE, and printing it as loose lines is what made the
 * old receipt hard to read. Quantity, rate and amount sit in fixed columns
 * under headings, so the eye can run down a price without re-reading the line.
 *
 * Matches the web receipt character for character, so a customer cannot tell
 * which device served them.
 *
 * Pure and side-effect free — this is what makes the layout unit-testable and
 * lets the on-screen preview show exactly what will print.
 */
export function buildReceipt(data: ReceiptData, profile: PrinterProfile): Uint8Array {
  const builder = new EscPosBuilder({
    charsPerLine: profile.charsPerLine,
    codepage: profile.codepage,
  });

  const width = profile.charsPerLine;
  // The frame is narrower than the paper and indented so it sits centred,
  // with a clear strip either side of the border.
  const margin = frameMargin(width);
  const frame = width - margin * 2;
  const pad = ' '.repeat(margin);
  const put = (line: string) => builder.line(pad + line);
  const { cols, showRate } = itemColumns(frame);
  const money = (amount: number) => formatCurrency(amount, data.currency);

  builder.init();

  // --- Header --------------------------------------------------------------
  // No logo: the ESC/POS builder has no raster support, and decoding a PNG to
  // a 1-bit bitmap is not something React Native can do without a native
  // image library. The web till prints the logo; here the name stands in.
  builder.align('center').bold(true).size(2, 2);
  builder.line(data.store.name.toUpperCase());
  builder.size(1, 1).bold(false);

  if (data.store.phone) builder.line(`Phone: ${data.store.phone}`);
  if (data.store.address) builder.wrapped(data.store.address);

  if (data.isReprint) {
    builder.bold(true).line('*** REPRINT ***').bold(false);
  }

  builder.align('left');
  put(boxRule(frame, { edge: 'top' }));

  // --- When -----------------------------------------------------------------
  // The invoice string is not printed on its own: the customer is called by
  // the order number below, and the ORD-<epoch> prefix only added noise.
  put(framed(frame, `Date: ${receiptStamp(data.date)}`));
  put(boxRule(frame));

  // --- The number the customer is called by, printed big --------------------
  writeOrderRow(
    builder,
    pad,
    frame,
    'Order No: ',
    orderNumberLabel(data.invoiceNumber).replace(/^#/, ''),
    'Customer Copy',
  );
  put(boxRule(frame));

  // --- Where it is going ----------------------------------------------------
  // "Takeaway              by: Ali": the server sits at the right edge of the
  // order-type row, and drops to the table row only when there is no order
  // type for it to share a row with.
  const by = data.dispatchedBy ? `by: ${data.dispatchedBy}` : '';
  let byShown = false;
  if (data.orderTypeLabel) {
    writeSplit(builder, pad, frame, data.orderTypeLabel, by);
    byShown = Boolean(by);
  }
  const trailing = byShown ? '' : by;
  if (data.tableName || data.customerName || trailing) {
    writeSplit(
      builder,
      pad,
      frame,
      data.tableName ? `Table No: ${data.tableName}` : (data.customerName || 'Walk-in'),
      trailing,
    );
  }
  if (data.tableName && data.customerName) {
    put(framed(frame, data.customerName));
  }
  /**
   * Delivery details, on the bill itself: the rider works from this paper, so
   * the name, phone and address have to be on it — a delivery receipt without
   * them is only half a document.
   */
  if (data.customerPhone) {
    put(framed(frame, `Phone: ${data.customerPhone}`));
  }
  if (data.deliveryAddress) {
    for (const line of wrapName(`Deliver to: ${data.deliveryAddress}`, frame - 4)) {
      put(framed(frame, line));
    }
  }

  // --- Items ----------------------------------------------------------------
  put(boxRule(frame, { below: cols }));
  // "Item", not "Item Description": the inset frame leaves the name column
  // too narrow for the long heading, and a clipped heading looks broken.
  builder.bold(true);
  put(tableRow(cols, showRate ? ['No', 'Item', 'Qty', 'Rate', 'Amount'] : ['No', 'Item', 'Qty', 'Amount']));
  builder.bold(false);
  put(boxRule(frame, { above: cols, below: cols }));

  let count = 0;
  data.items.forEach((item, index) => {
    count += Number(item.quantity) || 0;
    const lineTotal = item.unitPrice * item.quantity;

    // Long names wrap onto continuation rows inside the frame, instead of
    // being truncated the way the old layout did.
    const [first, ...rest] = wrapName(item.name, cols[1].width - 1);

    put(
      tableRow(
        cols,
        showRate
          ? [String(index + 1), first, String(item.quantity), plain(item.unitPrice), plain(lineTotal)]
          : [String(index + 1), first, String(item.quantity), plain(lineTotal)],
      ),
    );
    for (const continuation of rest) {
      put(tableRow(cols, ['', continuation]));
    }
    // So the customer can see which of their items were packed to go.
    if (item.isParcel) put(tableRow(cols, ['', '(parcel)']));
    if (item.discount > 0) {
      const discountRow = showRate
        ? ['', 'less discount', '', '', `-${plain(item.discount)}`]
        : ['', 'less discount', '', `-${plain(item.discount)}`];
      put(tableRow(cols, discountRow));
    }
  });

  put(boxRule(frame, { above: cols }));

  // --- Totals ---------------------------------------------------------------
  writeSplit(builder, pad, frame, `Items: ${count}`, money(data.rawSubtotal));

  if (data.totalDiscount > 0) {
    writeSplit(builder, pad, frame, 'Discount', `- ${money(data.totalDiscount)}`);
  }

  // The charge sits between the food and the payable so the customer can see
  // it is on top of the discounted order, not hidden inside it.
  if (Number(data.deliveryCharge) > 0) {
    writeSplit(builder, pad, frame, 'Delivery charges', money(Number(data.deliveryCharge)));
  }

  // Tax is 0 on web (the 8% line is commented out) and is never printed there.
  // Printing it only when non-zero keeps parity while supporting real tax.
  if (data.tax > 0) {
    writeSplit(builder, pad, frame, 'Tax', money(data.tax));
  }

  put(boxRule(frame));

  writeBig(builder, pad, frame, 'PAYABLE', money(data.total));

  if (data.paymentParts?.length) {
    // Each part on its own line, so the paper says how the money arrived.
    put(boxRule(frame));
    put(framed(frame, 'Paid by:'));
    for (const part of data.paymentParts) {
      writeSplit(builder, pad, frame, `  ${part.label}`, money(part.amount));
    }
  } else if (data.paymentMethod) {
    put(boxRule(frame));
    put(framed(frame, `Paid by: ${data.paymentMethod.toUpperCase()}`));
  }
  put(boxRule(frame, { edge: 'bottom' }));

  // --- Footer ---------------------------------------------------------------
  // ":)" rather than a smiley glyph: CP437 has one at byte 1, but that is a
  // control code most heads swallow.
  builder.newline().align('center');
  builder.bold(true).line('Thank you for visiting :)').bold(false);
  builder.line('tapntrade.store');
  builder.align('left');

  builder.feed(profile.autoCut ? 3 : 5);
  if (profile.autoCut) builder.cut();
  if (profile.openCashDrawer) builder.openCashDrawer();

  return builder.build();
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
