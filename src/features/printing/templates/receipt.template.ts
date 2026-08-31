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
  tax: number;
  total: number;
  paymentMethod?: string;
  currency: string;
  /** Marks a reprint so duplicates are distinguishable from the original. */
  isReprint?: boolean;
}

/**
 * Box drawing, with the real line characters.
 *
 * Safe here because the pipeline controls both ends: init() selects the
 * profile's code page (CP437 by default) with ESC t, and encodeText maps each
 * of these Unicode characters to the single CP437 byte whose glyph is a solid
 * line. ASCII "+-|" would survive any code page but visibly is not a line —
 * which is exactly what made the receipt look home-made.
 */
const H = '\u2500'; // ─
const V_RULE = '\u2502'; // │
const TL = '\u250c'; // ┌
const TR = '\u2510'; // ┐
const BL = '\u2514'; // └
const BR = '\u2518'; // ┘
const TEE_L = '\u251c'; // ├
const TEE_R = '\u2524'; // ┤
const TEE_D = '\u252c'; // ┬
const TEE_U = '\u2534'; // ┴
const CROSS = '\u253c'; // ┼

type RuleEdge = 'top' | 'mid' | 'bottom';

/** Character positions of the junctions a column layout puts on a rule. */
function junctionsOf(cols?: FrameColumn[]): Set<number> {
  const out = new Set<number>();
  if (!cols) return out;
  let x = 0;
  for (let i = 0; i < cols.length - 1; i += 1) {
    x += cols[i].width + 1;
    out.add(x);
  }
  return out;
}

interface FrameColumn {
  width: number;
  align?: 'left' | 'right';
}

/**
 * Item-table columns, sized so the vertical rules fit the paper exactly.
 *
 * 58mm paper DROPS the unit-rate column. Squeezing five columns into 32
 * characters leaves the dish name 8 characters and abbreviates the headings to
 * "Rat" and "Amo" — unreadable. The rate is derivable from qty and amount,
 * whereas a mangled dish name is simply lost, so the name wins the space.
 */
function itemColumns(charsPerLine: number): { cols: FrameColumn[]; showRate: boolean } {
  if (charsPerLine >= 48) {
    // 80 mm: No(3) Item(18) Qty(6) Rate(7) Amount(8) + 6 rules = 48
    return {
      showRate: true,
      cols: [
        { width: 3 },
        { width: 18 },
        { width: 6, align: 'right' },
        { width: 7, align: 'right' },
        { width: 8, align: 'right' },
      ],
    };
  }
  // 58 mm: No(3) Item(13) Qty(4) Amount(7) + 5 rules = 32
  return {
    showRate: false,
    cols: [
      { width: 3 },
      { width: 13 },
      { width: 4, align: 'right' },
      { width: 7, align: 'right' },
    ],
  };
}

/**
 * A horizontal rule that KNOWS what it sits between.
 *
 * The junction glyph at each column boundary depends on whether the boundary
 * continues above, below, or both — ┬ entering a table, ┼ inside it, ┴ leaving
 * it. Drawing every junction the same way is what makes an ASCII frame look
 * home-made; this is the detail that makes the table read as one printed form.
 */
function boxRule(
  width: number,
  opts: { above?: FrameColumn[]; below?: FrameColumn[]; edge?: RuleEdge } = {},
): string {
  const edge = opts.edge ?? 'mid';
  const above = junctionsOf(opts.above);
  const below = junctionsOf(opts.below);

  const chars: string[] = new Array(width).fill(H);
  chars[0] = edge === 'top' ? TL : edge === 'bottom' ? BL : TEE_L;
  chars[width - 1] = edge === 'top' ? TR : edge === 'bottom' ? BR : TEE_R;

  for (let i = 1; i < width - 1; i += 1) {
    const up = above.has(i);
    const down = below.has(i);
    if (up && down) chars[i] = CROSS;
    else if (down) chars[i] = TEE_D;
    else if (up) chars[i] = TEE_U;
  }

  return chars.join('');
}

/** One cell, padded to exactly `width` with a gutter so text clears the rule. */
function cell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const room = Math.max(1, width - 1);
  let value = String(text ?? '');
  if (value.length > room) value = value.slice(0, room);
  return align === 'right' ? value.padStart(room) + ' ' : ' ' + value.padEnd(room);
}

function tableRow(cols: FrameColumn[], values: string[]): string {
  return (
    V_RULE + cols.map((c, i) => cell(values[i] ?? '', c.width, c.align)).join(V_RULE) + V_RULE
  );
}

function framed(width: number, text = ''): string {
  return V_RULE + cell(text, width - 2) + V_RULE;
}

/** A framed line whose text is right-aligned. */
function framedRight(width: number, text: string): string {
  return V_RULE + cell(text, width - 2, 'right') + V_RULE;
}

/**
 * A framed line with text pushed to both edges.
 *
 * Returns TWO stacked rows when the pair cannot fit side by side. A single row
 * would otherwise have to grow past the paper width, and one over-long row is
 * what tears the whole frame open — 58mm paper with a long order number and a
 * full timestamp hits this immediately.
 */
function framedSplit(width: number, left: string, right: string): string[] {
  const room = width - 2;
  if (!right) return [framed(width, left)];
  if (left.length + right.length + 3 <= room) {
    const gap = room - left.length - right.length - 2;
    return [V_RULE + ' ' + left + ' '.repeat(gap) + right + ' ' + V_RULE];
  }
  return [framed(width, left), framedRight(width, right)];
}

/** Writes however many rows a split needed. */
function writeSplit(builder: EscPosBuilder, width: number, left: string, right: string): void {
  for (const line of framedSplit(width, left, right)) builder.line(line);
}

/**
 * A framed row whose right-hand value is printed double size, degrading to
 * normal size when it cannot fit doubled. Emphasis is worth losing; the
 * border is not.
 */
function writeBig(
  builder: EscPosBuilder,
  width: number,
  left: string,
  big: string,
): void {
  const room = width - 2;
  if (left.length + big.length * 2 + 3 > room) {
    writeSplit(builder, width, left, big);
    return;
  }
  const gap = room - left.length - big.length * 2 - 2;
  builder.text(V_RULE + ' ' + left + ' '.repeat(gap));
  builder.bold(true).size(2, 2).text(big).size(1, 1).bold(false);
  builder.line(' ' + V_RULE);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * "30-Aug-2026 9:09 PM".
 *
 * Spelled out rather than a locale format, which renders 8/30/2026 in one
 * locale and 30/8/2026 in another — on a printed bill that ambiguity is a
 * dispute waiting to happen.
 */
function receiptStamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const hours = date.getHours();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${MONTHS[date.getMonth()]}-${date.getFullYear()} ${h12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
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
  const { cols, showRate } = itemColumns(width);
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
  builder.line(boxRule(width, { edge: 'top' }));

  // --- Invoice number and when ---------------------------------------------
  writeSplit(builder, width, orderNumberLabel(data.invoiceNumber), receiptStamp(data.date));
  builder.line(boxRule(width));

  // --- The number the customer is called by, printed big --------------------
  builder.line(framed(width, 'Customer Copy'));

  writeBig(builder, width, 'Order Number:', String(data.invoiceNumber ?? '').replace(/^#/, ''));

  builder.line(boxRule(width));

  // --- Where it is going ----------------------------------------------------
  if (data.orderTypeLabel) builder.line(framed(width, data.orderTypeLabel));
  if (data.tableName || data.customerName || data.dispatchedBy) {
    writeSplit(
      builder,
      width,
      data.tableName ? `Table No: ${data.tableName}` : (data.customerName || 'Walk-in'),
      data.dispatchedBy ? `Served by: ${data.dispatchedBy}` : '',
    );
  }
  if (data.tableName && data.customerName) {
    builder.line(framed(width, data.customerName));
  }
  /**
   * Delivery details, on the bill itself: the rider works from this paper, so
   * the name, phone and address have to be on it — a delivery receipt without
   * them is only half a document.
   */
  if (data.customerPhone) {
    builder.line(framed(width, `Phone: ${data.customerPhone}`));
  }
  if (data.deliveryAddress) {
    for (const line of wrapName(`Deliver to: ${data.deliveryAddress}`, width - 4)) {
      builder.line(framed(width, line));
    }
  }

  // --- Items ----------------------------------------------------------------
  builder.line(boxRule(width, { below: cols }));
  builder.bold(true).line(
    tableRow(
      cols,
      showRate
        ? ['No', 'Item Description', 'Qty', 'Rate', 'Amount']
        : ['No', 'Item Description', 'Qty', 'Amount'],
    ),
  );
  builder.bold(false).line(boxRule(width, { above: cols, below: cols }));

  let count = 0;
  data.items.forEach((item, index) => {
    count += Number(item.quantity) || 0;
    const lineTotal = item.unitPrice * item.quantity;

    // Long names wrap onto continuation rows inside the frame, instead of
    // being truncated the way the old layout did.
    const [first, ...rest] = wrapName(item.name, cols[1].width - 1);

    builder.line(
      tableRow(
        cols,
        showRate
          ? [String(index + 1), first, String(item.quantity), plain(item.unitPrice), plain(lineTotal)]
          : [String(index + 1), first, String(item.quantity), plain(lineTotal)],
      ),
    );
    for (const continuation of rest) {
      builder.line(tableRow(cols, ['', continuation]));
    }
    // So the customer can see which of their items were packed to go.
    if (item.isParcel) builder.line(tableRow(cols, ['', '(parcel)']));
    if (item.discount > 0) {
      const discountRow = showRate
        ? ['', 'less discount', '', '', `-${plain(item.discount)}`]
        : ['', 'less discount', '', `-${plain(item.discount)}`];
      builder.line(tableRow(cols, discountRow));
    }
  });

  builder.line(boxRule(width, { above: cols }));

  // --- Totals ---------------------------------------------------------------
  writeSplit(builder, width, `Items: ${count}`, money(data.rawSubtotal));

  if (data.totalDiscount > 0) {
    writeSplit(builder, width, 'Discount', `- ${money(data.totalDiscount)}`);
  }

  // Tax is 0 on web (the 8% line is commented out) and is never printed there.
  // Printing it only when non-zero keeps parity while supporting real tax.
  if (data.tax > 0) {
    writeSplit(builder, width, 'Tax', money(data.tax));
  }

  builder.line(boxRule(width));

  writeBig(builder, width, 'PAYABLE', money(data.total));

  if (data.paymentMethod) {
    builder.line(boxRule(width));
    builder.line(framed(width, `Paid by: ${data.paymentMethod.toUpperCase()}`));
  }
  builder.line(boxRule(width, { edge: 'bottom' }));

  // --- Footer ---------------------------------------------------------------
  builder.newline().align('center');
  builder.bold(true).line('Thank you for visiting!').bold(false);
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
