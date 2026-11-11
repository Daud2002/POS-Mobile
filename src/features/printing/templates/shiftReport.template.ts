import { drawerNotes, drawerRows, hasTips, shiftFigures } from '@/lib/shiftMaths';
import { tipCellLabel, type TipCell } from '@/lib/tips';

import { EscPosBuilder } from '../escpos/builder';
import { PrinterProfile } from '../types';

/**
 * The Z-report a cashier prints when handing over their drawer.
 *
 * Deliberately separates TAKINGS from the DRAWER: card and online money never
 * passes through the till, so only the cash block reconciles against what is
 * physically counted. Printing the two together without that distinction is
 * how a cashier ends up "short" by the day's card sales.
 *
 * Tips get a block of their own between the two — never inside TAKINGS, which
 * is sales — and the drawer then shows them coming out, line by line, down to
 * the cash to hand over. The lines are lib/shiftMaths', the same ones the
 * close sheet shows.
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
  /** The cash to hand over, tips already out. */
  expectedCash: number;
  /**
   * Tips, when the shift recorded any. All optional: a shift without tips —
   * and any caller written before tips existed — prints the slip it always did.
   */
  cashTips?: number;
  cardTips?: number;
  onlineTips?: number;
  tipTotal?: number;
  tipsBreakdown?: TipCell[];
  totalReceived?: number;
  cashReceived?: number;
  cashInDrawer?: number;
  tipsFromDrawer?: number;
  tipsOwed?: number;
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

  const figures = shiftFigures({ openingFloat: data.openingFloat, totals: { ...data } });

  builder.bold(true).line('TAKINGS').bold(false);
  builder.row('Cash', money(data.cashSales));
  builder.row('Card', money(data.cardSales));
  builder.row('Online', money(data.onlineSales));
  if (Number(data.otherSales) > 0) builder.row('Other', money(data.otherSales));
  builder.bold(true).row('Total sales', money(data.totalSales)).bold(false);
  builder.divider();

  if (hasTips(figures)) {
    builder.bold(true).line('TIPS (not in sales)').bold(false);
    // By order type and method. ASCII only: "·" is not a glyph every thermal
    // code page carries.
    for (const cell of figures.tipsBreakdown) {
      builder.row(tipCellLabel(cell).replace(' · ', ' / '), money(cell.amount));
    }
    builder.bold(true).row('Total tips', money(figures.tipTotal)).bold(false);
    builder.row('Total received', money(figures.totalReceived));
    builder.divider();
  }

  // Only cash touches the drawer, which is why the reconciliation is here and
  // not against `totalSales`.
  builder.bold(true).line('CASH DRAWER').bold(false);
  for (const line of drawerRows(figures)) {
    if (line.result) {
      // A shift without tips keeps the wording its slip always had.
      const label = hasTips(figures) ? 'Cash to hand over' : 'Expected in drawer';
      builder.bold(true).row(label, money(line.amount)).bold(false);
    } else {
      const sign = line.sign === '−' ? '- ' : line.sign === '+' ? '+ ' : '';
      builder.row(sign + line.label, money(line.amount));
    }
  }
  for (const note of drawerNotes(figures, (n) => money(n))) {
    builder.wrapped(note);
  }

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
