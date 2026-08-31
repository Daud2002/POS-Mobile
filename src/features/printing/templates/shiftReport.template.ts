import { EscPosBuilder } from '../escpos/builder';
import { PrinterProfile } from '../types';

/**
 * The Z-report a cashier prints when handing over their drawer.
 *
 * Deliberately separates TAKINGS from the DRAWER: card and online money never
 * passes through the till, so only the cash block reconciles against what is
 * physically counted. Printing the two together without that distinction is
 * how a cashier ends up "short" by the day's card sales.
 */
export interface ShiftReportData {
  storeName?: string;
  cashierName?: string | null;
  openedAt?: string | Date | null;
  closedAt?: string | Date | null;
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  totalSales: number;
  orderCount: number;
  cashPaidOut: number;
  expectedCash: number;
  /** Null after an owner force-close, where nobody counted the drawer. */
  countedCash?: number | null;
  difference?: number | null;
  notes?: string | null;
}

export function buildShiftReport(
  data: ShiftReportData,
  profile: PrinterProfile,
): Uint8Array {
  const builder = new EscPosBuilder(profile);
  const money = (n: number | null | undefined) => Number(n ?? 0).toFixed(2);
  const time = (v?: string | Date | null) => (v ? new Date(v).toLocaleString() : '—');

  builder.init().align('center').bold(true).size(2, 2);
  builder.line('SHIFT REPORT');
  builder.size(1, 1).bold(false);
  if (data.storeName) builder.line(data.storeName);
  builder.align('left').divider('=');

  builder.row('Cashier', data.cashierName ?? '—');
  builder.row('Opened', time(data.openedAt));
  builder.row('Closed', time(data.closedAt));
  builder.row('Orders', String(data.orderCount ?? 0));
  builder.divider();

  builder.bold(true).line('TAKINGS').bold(false);
  builder.row('Cash', money(data.cashSales));
  builder.row('Card', money(data.cardSales));
  builder.row('Online', money(data.onlineSales));
  if (Number(data.otherSales) > 0) builder.row('Other', money(data.otherSales));
  builder.bold(true).row('Total sales', money(data.totalSales)).bold(false);
  builder.divider();

  // Only cash touches the drawer, which is why the reconciliation is here and
  // not against `totalSales`.
  builder.bold(true).line('CASH DRAWER').bold(false);
  builder.row('Opening float', money(data.openingFloat));
  builder.row('+ Cash sales', money(data.cashSales));
  builder.row('- Cash paid out', money(data.cashPaidOut));
  builder.bold(true).row('Expected in drawer', money(data.expectedCash)).bold(false);

  if (data.countedCash === null || data.countedCash === undefined) {
    builder.row('Counted', 'NOT COUNTED');
  } else {
    builder.row('Counted', money(data.countedCash));
    const diff = Number(data.difference ?? 0);
    const label = diff === 0 ? 'Balanced' : diff > 0 ? 'OVER' : 'SHORT';
    builder.bold(true).size(1, 2);
    builder.row(label, money(Math.abs(diff)));
    builder.size(1, 1).bold(false);
  }

  if (data.notes) {
    builder.divider();
    builder.wrapped(data.notes);
  }

  builder.divider('=');
  // Two signature lines: this slip is the physical record of the handover.
  builder.newline();
  builder.line('Cashier: ______________________');
  builder.newline();
  builder.line('Received by: __________________');

  builder.feed(profile.autoCut ? 3 : 5);
  if (profile.autoCut) builder.cut();

  return builder.build();
}
