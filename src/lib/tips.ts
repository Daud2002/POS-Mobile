import type { Decimal, PaymentSplit } from '@/api/types';

import { round2, toNumber } from './format';
import { SPLIT_METHODS, paymentMethodLabel, splitSum, type SplitMethod } from './payment';

/**
 * Tips — money a customer leaves on top of the bill.
 *
 * The owner switches tip recording on per payment method (on the web app; this
 * app only reads the switches off the profile). With a method on, the till
 * asks how much was RECEIVED when a bill is paid that way, and what is above
 * the bill is the tip. The tip is sent beside the bill, never inside it: the
 * split (if any) still adds up to the bill alone, and revenue never sees a
 * tip. Mirrors resolveTip() in Backend/src/modules/restaurant/order-rules.ts
 * and the web app's lib/tips.ts.
 */
export type TipMethod = SplitMethod;

/** Which payment methods the store records tips for. */
export type TipPolicy = Record<TipMethod, boolean>;

interface TipFlags {
  tipsCashEnabled?: boolean | null;
  tipsCardEnabled?: boolean | null;
  tipsOnlineEnabled?: boolean | null;
}

/**
 * The owner's switches, as they ride on the profile. All off for a profile
 * from a server that predates tips, which keeps the till exactly as it was.
 */
export function tipPolicyOf(user?: TipFlags | null): TipPolicy {
  return {
    cash: !!user?.tipsCashEnabled,
    card: !!user?.tipsCardEnabled,
    online: !!user?.tipsOnlineEnabled,
  };
}

export function recordsAnyTips(policy: TipPolicy): boolean {
  return policy.cash || policy.card || policy.online;
}

export function isTipMethod(method?: string | null): method is TipMethod {
  return method === 'cash' || method === 'card' || method === 'online';
}

/**
 * What the "Amount received" box means on a single-method payment.
 *
 * Blank is "exactly the bill" — the common case must stay one tap. Less than
 * the bill cannot be taken; more than the bill is the tip.
 */
export function tipFromReceived(
  total: number,
  receivedText: string,
): { tip: number; short: number; blank: boolean } {
  const text = (receivedText ?? '').trim();
  const due = round2(total);
  if (text === '') return { tip: 0, short: 0, blank: true };

  const received = Number(text);
  if (!Number.isFinite(received) || received < 0) return { tip: 0, short: due, blank: false };

  const over = round2(round2(received) - due);
  if (over < -0.009) return { tip: 0, short: round2(-over), blank: false };
  return { tip: Math.max(over, 0), short: 0, blank: false };
}

/**
 * A split whose boxes add up to MORE than the bill: the excess is the tip.
 *
 * `eligible` is the methods the tip can have come by — switched on by the
 * owner, and with at least the tip's worth received that way (a 100 tip
 * cannot have come out of a 60 card payment).
 */
export function splitTip(
  total: number,
  received: PaymentSplit,
  policy: TipPolicy,
): { tip: number; eligible: TipMethod[] } {
  const over = round2(splitSum(received) - round2(total));
  if (over < 0.01) return { tip: 0, eligible: [] };
  return {
    tip: over,
    eligible: SPLIT_METHODS.filter((m) => policy[m] && received[m] >= over - 0.009),
  };
}

/** What POST …/settle and …/credit/settle take. */
export interface SettleBody {
  paymentMethod: string;
  split?: PaymentSplit;
  tipAmount?: number;
  tipMethod?: TipMethod;
  /** The bill the cashier was shown; the server refuses if it is charging another. */
  expectedTotal?: number;
}

export interface SettlePlan {
  /** Null when the payment cannot be taken as typed; `problem` says why. */
  body: SettleBody | null;
  problem: string | null;
  tip: number;
  tipMethod: TipMethod | null;
  /** For a split with a tip: the methods the cashier may attribute it to. */
  eligible: TipMethod[];
}

/**
 * Turns what the cashier typed into the request, or the reason it cannot be
 * sent. One function for the till and for collecting a credit sale, so the
 * two can never disagree about what a tip is.
 *
 * `total` must be the figure the server will charge — the PRINTED bill — not
 * a live preview: the tip is the difference from it.
 */
export function planSettlement(input: {
  total: number;
  paymentMethod: string;
  policy: TipPolicy;
  /** The "Amount received" box of a single-method payment. */
  receivedText: string;
  /** The split boxes, parsed. With tips on they hold what was received. */
  split: PaymentSplit;
  /** The cashier's pick for a split tip; the first eligible method when null. */
  tipMethod: TipMethod | null;
}): SettlePlan {
  const total = round2(input.total);
  const none = { tip: 0, tipMethod: null, eligible: [] as TipMethod[] };

  if (input.paymentMethod !== 'partial') {
    const method = input.paymentMethod;
    // A method the owner does not record tips for is paid exactly as before.
    if (!isTipMethod(method) || !input.policy[method]) {
      return { body: { paymentMethod: method }, problem: null, ...none };
    }

    const { tip, short } = tipFromReceived(total, input.receivedText);
    if (short > 0) {
      return { body: null, problem: 'The amount received is less than the bill', ...none };
    }
    return {
      body: {
        paymentMethod: method,
        expectedTotal: total,
        ...(tip > 0 ? { tipAmount: tip, tipMethod: method } : {}),
      },
      problem: null,
      tip,
      tipMethod: tip > 0 ? method : null,
      eligible: [],
    };
  }

  const remaining = round2(total - splitSum(input.split));
  if (remaining > 0.009) {
    return { body: null, problem: 'The split has to add up to the bill before it can be taken', ...none };
  }
  if (Math.abs(remaining) < 0.01) {
    return { body: { paymentMethod: 'partial', split: input.split }, problem: null, ...none };
  }

  // Over the bill. Without tips that is simply a typo, as it always was.
  const { tip, eligible } = splitTip(total, input.split, input.policy);
  if (!recordsAnyTips(input.policy)) {
    return { body: null, problem: 'The split has to add up to the bill before it can be taken', ...none };
  }
  if (!eligible.length) {
    return {
      body: null,
      problem: 'The extra over the bill does not fit any one amount. Check the figures.',
      tip,
      tipMethod: null,
      eligible,
    };
  }

  const tipMethod =
    input.tipMethod && eligible.includes(input.tipMethod) ? input.tipMethod : eligible[0];
  return {
    body: {
      paymentMethod: 'partial',
      // Back to the bill alone: the tip comes off the part it arrived by.
      split: { ...input.split, [tipMethod]: round2(input.split[tipMethod] - tip) },
      tipAmount: tip,
      tipMethod,
      expectedTotal: total,
    },
    problem: null,
    tip,
    tipMethod,
    eligible,
  };
}

/**
 * True when the server did not store the tip the till sent — an older store
 * server drops fields it does not know. The payment still went through, so
 * the till can only warn.
 */
export function tipWasDropped(sent: SettleBody, saved: { tipAmount?: unknown } | null | undefined): boolean {
  const tip = sent.tipAmount ?? 0;
  return tip > 0 && Math.abs(toNumber(saved?.tipAmount as Decimal) - tip) > 0.009;
}

// ------------------------------------------------------------ the breakdown

export type TipOrderType = 'dine_in' | 'takeaway' | 'delivery';

/** One line of the "Tips" dropdown. */
export interface TipCell {
  orderType: TipOrderType;
  method: TipMethod;
  amount: number;
}

const TIP_ORDER_TYPE_LABELS: Record<TipOrderType, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

/** The server's breakdown, defensively read: an older server sends none. */
export function tipCells(raw: unknown): TipCell[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((cell) => ({
      orderType: cell?.orderType as TipOrderType,
      method: cell?.method as TipMethod,
      amount: toNumber(cell?.amount),
    }))
    .filter(
      (cell) =>
        // Own keys only: `in` would also say yes to "toString".
        Object.prototype.hasOwnProperty.call(TIP_ORDER_TYPE_LABELS, cell.orderType) &&
        isTipMethod(cell.method) &&
        cell.amount > 0,
    );
}

/** "Dine-in · Cash" */
export function tipCellLabel(cell: Pick<TipCell, 'orderType' | 'method'>): string {
  return `${TIP_ORDER_TYPE_LABELS[cell.orderType]} · ${paymentMethodLabel(cell.method)}`;
}
