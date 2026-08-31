import { timeLabel } from '@/lib/date';
import { orderNumberLabel } from '@/lib/format';
import { orderTypeLabel } from '@/lib/orderLabel';

import { EscPosBuilder } from '../escpos/builder';
import { PrinterProfile } from '../types';

/**
 * A kitchen ticket, not a receipt.
 *
 * Deliberately carries no prices: the kitchen needs what to cook, for which
 * table, who sent it, and any special instructions. Quantities are printed
 * first and emphasised because that is the field misread under pressure.
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
    /** Pack this line to go, on a dine_out order that also eats in. */
    isParcel?: boolean;
  }>;
  /**
   * Set for a second or later round so the kitchen can tell an addition from
   * a new order, and for a reprint so a duplicate is not cooked twice.
   */
  variant?: 'new' | 'additional' | 'reprint';
}

function heading(variant: KitchenTicketData['variant']): string {
  if (variant === 'additional') return 'ADDITIONAL ROUND';
  if (variant === 'reprint') return 'REPRINT';
  return 'KITCHEN ORDER';
}

export function buildKitchenTicket(
  data: KitchenTicketData,
  profile: PrinterProfile,
): Uint8Array {
  const builder = new EscPosBuilder(profile);
  const charsPerLine = profile.charsPerLine ?? 32;

  builder.init().align('center').bold(true).size(2, 2);
  builder.line(heading(data.variant));
  builder.size(1, 1).bold(false);
  builder.divider('=');

  // The destination is the single most important line on the ticket.
  builder.bold(true).size(2, 2);
  builder.line(data.tableName ?? orderTypeLabel(data.orderType).toUpperCase());
  builder.size(1, 1).bold(false);
  /**
   * A dine-out order sits at a table AND takes a parcel home. Without this
   * line the ticket looks like any other dine-in and the kitchen has no reason
   * to box anything.
   */
  if (data.orderType === 'dine_out') {
    builder.bold(true).line('*** DINE-OUT + PARCEL ***').bold(false);
  }
  builder.divider('=');

  builder.align('left');
  builder.row(
    'Order',
    data.orderSequence ? `#${data.orderSequence}` : orderNumberLabel(data.orderNumber),
  );
  if (data.waiterName) builder.row('Waiter', data.waiterName);
  builder.row('Time', timeLabel(data.date));
  builder.divider();

  for (const item of data.items) {
    const prefix = `${String(item.quantity).padStart(2, ' ')} x `;
    builder.bold(true);
    // Wrap rather than truncate: a clipped dish name is a wrong order.
    for (const [index, chunk] of wrap(item.name, charsPerLine - prefix.length).entries()) {
      builder.line(index === 0 ? prefix + chunk : ' '.repeat(prefix.length) + chunk);
    }
    builder.bold(false);

    // Which specific dishes get boxed — the whole point of a dine-out order.
    if (item.isParcel) {
      builder.bold(true).line(' '.repeat(prefix.length) + '>> PARCEL').bold(false);
    }

    if (item.notes) {
      for (const chunk of wrap(`** ${item.notes}`, charsPerLine - prefix.length)) {
        builder.line(' '.repeat(prefix.length) + chunk);
      }
    }
  }

  builder.divider();
  builder.feed(3);
  if (profile.autoCut) builder.cut();

  return builder.build();
}

/** Word wrap that never drops characters. */
function wrap(value: string, width: number): string[] {
  const safeWidth = Math.max(8, width);
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= safeWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
    // A single word longer than the line still has to be broken somewhere.
    while (current.length > safeWidth) {
      lines.push(current.slice(0, safeWidth));
      current = current.slice(safeWidth);
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/** Adapts an API order into ticket data. */
export function kitchenTicketFromOrder(
  order: {
    orderNumber: string;
    orderSequence?: number | null;
    tableName?: string | null;
    waiterName?: string | null;
    orderType?: string;
    createdAt?: string;
    items: Array<{
      productName: string;
      quantity: number;
      notes?: string | null;
      isParcel?: boolean;
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
    date: order.createdAt ? new Date(order.createdAt) : new Date(),
    variant: options.variant ?? 'new',
    items: (source ?? []).map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      notes: item.notes,
      isParcel: item.isParcel,
    })),
  };
}
