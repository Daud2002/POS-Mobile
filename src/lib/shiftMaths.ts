import type { CashierShift, Decimal } from '@/api/types';

import { round2, toNumber } from './format';
import { tipCells, type TipCell } from './tips';

/**
 * A shift's money, laid out for display.
 *
 * Every shift screen and the printed slip render from here, so "cash to hand
 * over" cannot mean one thing in the close sheet and another on paper. The
 * arithmetic itself is the SERVER's (shifts/shift-rules.ts): this file only
 * reads its figures, and fills in the ones an older server does not send so a
 * shift without tips looks exactly as it did before tips existed.
 *
 * Mirrors the web app's lib/shiftMaths.ts.
 */
export interface ShiftFigures {
  openingFloat: number;
  /** Bills only. Tips are never in the sales figures. */
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  totalSales: number;
  orderCount: number;
  cashPaidOut: number;
  cashTips: number;
  cardTips: number;
  onlineTips: number;
  tipTotal: number;
  /** Tips by order type and method — the "Tips" dropdown. */
  tipsBreakdown: TipCell[];
  /** totalSales + tipTotal. */
  totalReceived: number;
  /** cashSales + cashTips. */
  cashReceived: number;
  /** What the drawer holds before tips are taken out. */
  cashInDrawer: number;
  /** Card/online tips the store pays out of this drawer; 0 when it does not. */
  tipsFromDrawer: number;
  /** Card/online tips the drawer could not cover. */
  tipsOwed: number;
  /** The cash to hand over, tips already out. */
  expectedCash: number;
}

/**
 * A shift as the API types it, or any object carrying the same figures — a
 * row out of a list, the printed report's data. (The typed arm is there
 * because an interface carries no index signature.)
 */
type ShiftLike =
  | CashierShift
  | {
      openingFloat?: unknown;
      totals?: Record<string, unknown> | null;
      [key: string]: unknown;
    };

/**
 * Numbers out of a shift: its live or frozen `totals` when present, else the
 * snapshot columns on the row itself (a shift in a list carries no `totals`).
 */
export function shiftFigures(shift: ShiftLike | null | undefined): ShiftFigures {
  const source = (shift?.totals ?? shift ?? {}) as Record<string, unknown>;
  const num = (key: string) => toNumber(source[key] as Decimal);
  const has = (key: string) => source[key] !== null && source[key] !== undefined;

  const openingFloat = toNumber(shift?.openingFloat as Decimal);
  const cashSales = num('cashSales');
  const cashPaidOut = num('cashPaidOut');
  const cashTips = num('cashTips');
  const cardTips = num('cardTips');
  const onlineTips = num('onlineTips');
  const tipTotal = has('tipTotal') ? num('tipTotal') : round2(cashTips + cardTips + onlineTips);
  const totalSales = num('totalSales');
  const tipsFromDrawer = num('tipsFromDrawer');
  const cashReceived = has('cashReceived') ? num('cashReceived') : round2(cashSales + cashTips);
  const cashInDrawer = has('cashInDrawer')
    ? num('cashInDrawer')
    : round2(openingFloat + cashReceived - cashPaidOut);

  return {
    openingFloat,
    cashSales,
    cardSales: num('cardSales'),
    onlineSales: num('onlineSales'),
    otherSales: num('otherSales'),
    totalSales,
    orderCount: num('orderCount'),
    cashPaidOut,
    cashTips,
    cardTips,
    onlineTips,
    tipTotal,
    tipsBreakdown: tipCells(source.tipsBreakdown ?? source.tipBreakdown),
    totalReceived: has('totalReceived') ? num('totalReceived') : round2(totalSales + tipTotal),
    cashReceived,
    cashInDrawer,
    tipsFromDrawer,
    tipsOwed: num('tipsOwed'),
    // The server's figure, always. Only a row that has none at all (an open
    // shift in a list) falls back to the drawer less the tips that leave it.
    expectedCash: has('expectedCash')
      ? num('expectedCash')
      : round2(cashInDrawer - cashTips - tipsFromDrawer),
  };
}

export function hasTips(figures: ShiftFigures): boolean {
  return figures.tipTotal > 0;
}

/** One method's line of the takings: what came in, how much of it was tips, the sales left. */
export interface TakingsRow {
  key: 'cash' | 'card' | 'online' | 'other' | 'total';
  label: string;
  received: number;
  tips: number;
  sales: number;
}

/**
 * Takings by method, then the total. "Other" (cheques) only when there are
 * any. Read across: received − tips = sales.
 */
export function takingsRows(figures: ShiftFigures): TakingsRow[] {
  const line = (key: TakingsRow['key'], label: string, sales: number, tips: number): TakingsRow => ({
    key,
    label,
    received: round2(sales + tips),
    tips,
    sales,
  });

  const rows = [
    line('cash', 'Cash', figures.cashSales, figures.cashTips),
    line('card', 'Card', figures.cardSales, figures.cardTips),
    line('online', 'Online', figures.onlineSales, figures.onlineTips),
  ];
  if (figures.otherSales > 0) rows.push(line('other', 'Other', figures.otherSales, 0));
  rows.push(line('total', 'Total', figures.totalSales, figures.tipTotal));
  return rows;
}

/** One line of the drawer arithmetic. `sign` is how it enters the sum. */
export interface DrawerRow {
  key: string;
  label: string;
  amount: number;
  sign: '' | '+' | '−';
  /** The bottom line: the cash to hand over. */
  result?: boolean;
}

/**
 * The cash the cashier counts against: "Cash to hand over" once tips are in
 * play (they are taken out before counting), "Should be in drawer" on a shift
 * with none — the wording it always had.
 */
export function handoverLabel(figures: ShiftFigures): string {
  return hasTips(figures) ? 'Cash to hand over' : 'Should be in drawer';
}

/** Card/online tips that actually came out of the drawer. */
export function tipsCoveredFromDrawer(figures: ShiftFigures): number {
  return round2(Math.max(figures.tipsFromDrawer - figures.tipsOwed, 0));
}

/** Everything the cashier takes out for tips before counting. */
export function tipsOutOfDrawer(figures: ShiftFigures): number {
  return round2(figures.cashTips + tipsCoveredFromDrawer(figures));
}

/**
 * The drawer, top to bottom:
 *
 *   opening float + cash received − cash paid out
 *   − cash tips − card/online tips taken from cash = cash to hand over
 *
 * A shift without tips keeps its old three lines and old wording.
 */
export function drawerRows(figures: ShiftFigures): DrawerRow[] {
  const result: DrawerRow = {
    key: 'handover',
    label: handoverLabel(figures),
    amount: figures.expectedCash,
    sign: '',
    result: true,
  };

  if (!hasTips(figures)) {
    return [
      { key: 'float', label: 'Opening float', amount: figures.openingFloat, sign: '' },
      { key: 'cash', label: 'Cash sales', amount: figures.cashSales, sign: '+' },
      { key: 'paidOut', label: 'Cash paid out', amount: figures.cashPaidOut, sign: '−' },
      result,
    ];
  }

  const rows: DrawerRow[] = [
    { key: 'float', label: 'Opening float', amount: figures.openingFloat, sign: '' },
    { key: 'cash', label: 'Cash received', amount: figures.cashReceived, sign: '+' },
    { key: 'paidOut', label: 'Cash paid out', amount: figures.cashPaidOut, sign: '−' },
  ];
  if (figures.cashTips > 0) {
    rows.push({ key: 'cashTips', label: 'Cash tips', amount: figures.cashTips, sign: '−' });
  }
  const covered = tipsCoveredFromDrawer(figures);
  if (covered > 0) {
    rows.push({ key: 'otherTips', label: 'Card/online tips', amount: covered, sign: '−' });
  }
  rows.push(result);
  return rows;
}

/**
 * What the arithmetic alone does not say: where the card/online tips went
 * when they did not come out of the cash, and any the drawer could not cover.
 */
export function drawerNotes(figures: ShiftFigures, money: (amount: number) => string): string[] {
  const notes: string[] = [];
  const nonCash = round2(figures.cardTips + figures.onlineTips);

  if (nonCash > 0 && figures.tipsFromDrawer === 0) {
    notes.push(
      `Card/online tips of ${money(nonCash)} are not taken from cash. They come off the card/online money.`,
    );
  }
  if (figures.tipsOwed > 0) {
    notes.push(
      `The drawer could not cover ${money(figures.tipsOwed)} of card/online tips. That is still owed to staff.`,
    );
  }
  return notes;
}
