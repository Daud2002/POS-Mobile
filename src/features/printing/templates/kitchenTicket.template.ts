import { orderNumberLabel } from '@/lib/format';
import { orderTypeLabel } from '@/lib/orderLabel';

import { EscPosBuilder, wrapText } from '../escpos/builder';
import { PrinterProfile } from '../types';

import {
  boxRule,
  FrameColumn,
  frameMargin,
  framed,
  receiptStamp,
  tableRow,
  writeOrderRow,
  writeSplit,
} from './frame';
import { decodePrintable } from './receipt.template';

/**
 * A kitchen ticket, not a receipt.
 *
 * Deliberately carries no prices: the kitchen needs what to cook, for which
 * table, who sent it, and any special instructions.
 */
export interface KitchenTicketData {
  orderNumber: string;
  /** Per-store display number. Preferred over orderNumber on paper. */
  orderSequence?: number | null;
  /** Null for takeaway and delivery, which print their type instead. */
  tableName?: string | null;
  waiterName?: string | null;
  orderType?: string;
  date: Date;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string | null;
    /** Printed under the dish so the right station picks it up. */
    categoryName?: string | null;
    /** Pack this line to go, on a dine_out order that also eats in. */
    isParcel?: boolean;
  }>;
  /** Order-level instructions, printed under the item table. */
  orderNotes?: string | null;
  /** Printed for takeaway and delivery, which have no table to go to. */
  customerName?: string | null;
  customerPhone?: string | null;
  /**
   * Set for a second or later round so the kitchen can tell an addition from
   * a new order, and for a reprint so a duplicate is not cooked twice.
   */
  variant?: 'new' | 'additional' | 'reprint' | 'cancelled';
}

function heading(variant: KitchenTicketData['variant']): string {
  if (variant === 'additional') return 'ADDITIONAL ROUND';
  if (variant === 'reprint') return 'REPRINT';
  // The cashier struck these lines off while they were still being cooked.
  if (variant === 'cancelled') return 'CANCELLED ITEMS';
  return 'KITCHEN ORDER';
}

/**
 * Ticket-table columns: No | Item Description | Qty.
 *
 * With no rate or amount to print, the dish name takes every column the
 * cashier receipt spends on money — a clipped dish name is a wrong order.
 */
function ticketColumns(frame: number): FrameColumn[] {
  // No(3) Item(frame - 12) Qty(5) + 4 rules = frame
  return [{ width: 3 }, { width: frame - 12 }, { width: 5, align: 'right' }];
}

/**
 * Renders a kitchen ticket to ESC/POS bytes.
 *
 * The same bordered form as the cashier receipt, so the two papers read as one
 * system — but with no store header, no footer and no money: the kitchen needs
 * what to cook, for which table, who sent it, and any special instructions.
 */
export function buildKitchenTicket(
  data: KitchenTicketData,
  profile: PrinterProfile,
): Uint8Array {
  const builder = new EscPosBuilder({
    charsPerLine: profile.charsPerLine,
    codepage: profile.codepage,
  });

  const width = profile.charsPerLine;
  const margin = frameMargin(width);
  const frame = width - margin * 2;
  const pad = ' '.repeat(margin);
  const put = (line: string) => builder.line(pad + line);
  const cols = ticketColumns(frame);
  // Text room inside a framed row: two rules and a gutter either side.
  const textRoom = frame - 4;

  builder.init();

  // --- Header: what kind of ticket this is ----------------------------------
  builder.align('center').bold(true).size(2, 2);
  builder.line(heading(data.variant));
  builder.size(1, 1).bold(false);

  builder.align('left');
  put(boxRule(frame, { edge: 'top' }));

  // --- When -----------------------------------------------------------------
  put(framed(frame, `Date: ${receiptStamp(data.date)}`));
  put(boxRule(frame));

  // --- The number the order is called by, printed big -----------------------
  writeOrderRow(
    builder,
    pad,
    frame,
    'Order No: ',
    data.orderSequence ? String(data.orderSequence) : orderNumberLabel(data.orderNumber),
    'Kitchen Copy',
  );
  put(boxRule(frame));

  // --- Where it is going ----------------------------------------------------
  const by = data.waiterName ? `by: ${data.waiterName}` : '';
  let byShown = false;
  if (data.orderType && data.orderType !== 'none') {
    writeSplit(builder, pad, frame, orderTypeLabel(data.orderType), by);
    byShown = Boolean(by);
  }
  const trailing = byShown ? '' : by;
  if (data.tableName) {
    writeSplit(builder, pad, frame, `Table No: ${data.tableName}`, trailing);
  } else {
    // Takeaway and delivery: who the bag is for.
    if (data.customerName || trailing) {
      writeSplit(builder, pad, frame, data.customerName || 'Walk-in', trailing);
    }
    if (data.customerPhone) put(framed(frame, `Phone: ${data.customerPhone}`));
  }
  /**
   * A dine-out order sits at a table AND takes a parcel home. Without this
   * line the ticket looks like any other dine-in and the kitchen has no reason
   * to box anything.
   */
  if (data.orderType === 'dine_out') {
    builder.bold(true);
    put(framed(frame, '*** DINE-OUT + PARCEL ***'));
    builder.bold(false);
  }

  // --- Items ----------------------------------------------------------------
  put(boxRule(frame, { below: cols }));
  builder.bold(true);
  put(tableRow(cols, ['No', 'Item Description', 'Qty']));
  builder.bold(false);
  put(boxRule(frame, { above: cols, below: cols }));

  const itemRoom = cols[1].width - 1;
  let count = 0;
  data.items.forEach((item, index) => {
    count += Number(item.quantity) || 0;

    // Wrap rather than truncate: a clipped dish name is a wrong order.
    const [first, ...rest] = wrapText(item.name, itemRoom);
    put(tableRow(cols, [String(index + 1), first, String(item.quantity)]));
    for (const continuation of rest) put(tableRow(cols, ['', continuation]));

    if (item.categoryName) {
      for (const line of wrapText(`(${item.categoryName})`, itemRoom)) {
        put(tableRow(cols, ['', line]));
      }
    }
    // Which specific dishes get boxed — the whole point of a dine-out order.
    if (item.isParcel) put(tableRow(cols, ['', '>> PARCEL']));
    if (item.notes) {
      builder.bold(true);
      for (const line of wrapText(`** ${item.notes}`, itemRoom)) {
        put(tableRow(cols, ['', line]));
      }
      builder.bold(false);
    }
  });

  put(boxRule(frame, { above: cols }));
  put(framed(frame, `Total items: ${count}`));

  if (data.orderNotes) {
    put(boxRule(frame));
    builder.bold(true);
    put(framed(frame, 'Order notes:'));
    for (const line of wrapText(data.orderNotes, textRoom)) put(framed(frame, line));
    builder.bold(false);
  }
  put(boxRule(frame, { edge: 'bottom' }));

  builder.feed(profile.autoCut ? 3 : 5);
  if (profile.autoCut) builder.cut();

  return builder.build();
}

/** Renders the ticket as plain text, for tests and on-screen previews. */
export function renderKitchenTicketText(
  data: KitchenTicketData,
  profile: PrinterProfile,
): string {
  return decodePrintable(buildKitchenTicket(data, profile));
}

/**
 * Adapts an API order into ticket data.
 *
 * Lines the kitchen does not cook — drinks, stamped `skipKitchen` by the
 * server — are left off. A ticket with no lines left is not worth paper;
 * callers check `items.length` before printing.
 */
export function kitchenTicketFromOrder(
  order: {
    orderNumber: string;
    orderSequence?: number | null;
    tableName?: string | null;
    waiterName?: string | null;
    orderType?: string;
    createdAt?: string;
    /** Order-level notes. */
    notes?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    items: Array<{
      productName: string;
      quantity: number;
      notes?: string | null;
      categoryName?: string | null;
      isParcel?: boolean;
      skipKitchen?: boolean;
    }>;
  },
  options: { variant?: KitchenTicketData['variant']; items?: typeof order.items } = {},
): KitchenTicketData {
  const source = options.items ?? order.items;
  return {
    orderNumber: order.orderNumber,
    orderSequence: order.orderSequence,
    tableName: order.tableName,
    waiterName: order.waiterName,
    orderType: order.orderType,
    orderNotes: order.notes,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    date: order.createdAt ? new Date(order.createdAt) : new Date(),
    variant: options.variant ?? 'new',
    items: (source ?? [])
      .filter((item) => !item.skipKitchen)
      .map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        notes: item.notes,
        categoryName: item.categoryName,
        isParcel: item.isParcel,
      })),
  };
}
