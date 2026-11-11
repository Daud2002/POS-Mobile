import {
  planSettlement,
  recordsAnyTips,
  splitTip,
  tipCellLabel,
  tipCells,
  tipFromReceived,
  tipPolicyOf,
  tipWasDropped,
  type TipPolicy,
} from '../tips';

const ALL: TipPolicy = { cash: true, card: true, online: true };
const CARD_ONLY: TipPolicy = { cash: false, card: true, online: false };
const NONE: TipPolicy = { cash: false, card: false, online: false };
const NO_SPLIT = { cash: 0, card: 0, online: 0 };

/** A plan for a 1,000 bill unless told otherwise. */
const plan = (over: Partial<Parameters<typeof planSettlement>[0]>) =>
  planSettlement({
    total: 1000,
    paymentMethod: 'cash',
    policy: ALL,
    receivedText: '',
    split: NO_SPLIT,
    tipMethod: null,
    ...over,
  });

describe('tipPolicyOf', () => {
  it('reads the owner’s three switches off the profile', () => {
    expect(tipPolicyOf({ tipsCashEnabled: true, tipsOnlineEnabled: true })).toEqual({
      cash: true,
      card: false,
      online: true,
    });
  });

  it('records nothing for a profile from a server that predates tips', () => {
    expect(tipPolicyOf({})).toEqual(NONE);
    expect(tipPolicyOf(null)).toEqual(NONE);
    expect(recordsAnyTips(tipPolicyOf(null))).toBe(false);
    expect(recordsAnyTips(CARD_ONLY)).toBe(true);
  });
});

describe('tipFromReceived', () => {
  it('treats a blank box as exactly the bill', () => {
    expect(tipFromReceived(1000, '')).toEqual({ tip: 0, short: 0, blank: true });
    expect(tipFromReceived(1000, '   ')).toEqual({ tip: 0, short: 0, blank: true });
  });

  it('calls anything above the bill the tip', () => {
    expect(tipFromReceived(1000, '1150')).toEqual({ tip: 150, short: 0, blank: false });
    expect(tipFromReceived(1000, '1000')).toEqual({ tip: 0, short: 0, blank: false });
    expect(tipFromReceived(849.5, '900').tip).toBe(50.5);
  });

  it('says how far short an amount below the bill is', () => {
    expect(tipFromReceived(1000, '950')).toEqual({ tip: 0, short: 50, blank: false });
    expect(tipFromReceived(1000, 'abc').short).toBe(1000);
    expect(tipFromReceived(1000, '-5').short).toBe(1000);
  });

  it('is not thrown by floating-point noise', () => {
    expect(tipFromReceived(0.3, '0.3')).toEqual({ tip: 0, short: 0, blank: false });
    expect(tipFromReceived(0.1 + 0.2, '0.4').tip).toBe(0.1);
  });
});

describe('splitTip', () => {
  it('is the excess of the boxes over the bill', () => {
    expect(splitTip(1000, { cash: 600, card: 500, online: 0 }, ALL)).toEqual({
      tip: 100,
      eligible: ['cash', 'card'],
    });
  });

  it('is nothing when the boxes are at or under the bill', () => {
    expect(splitTip(1000, { cash: 600, card: 400, online: 0 }, ALL)).toEqual({ tip: 0, eligible: [] });
    expect(splitTip(1000, { cash: 600, card: 300, online: 0 }, ALL).tip).toBe(0);
  });

  it('only offers methods the owner records tips for', () => {
    expect(splitTip(1000, { cash: 600, card: 500, online: 0 }, CARD_ONLY).eligible).toEqual(['card']);
  });

  it('only offers a method that received at least the tip', () => {
    // 150 over: it cannot have come out of the 100 paid online.
    expect(splitTip(1000, { cash: 0, card: 1050, online: 100 }, ALL).eligible).toEqual(['card']);
    // Nothing fits: three small amounts, a tip bigger than any of them.
    expect(splitTip(100, { cash: 150, card: 150, online: 150 }, ALL)).toEqual({ tip: 350, eligible: [] });
  });
});

describe('planSettlement — one method', () => {
  it('pays a method without tips exactly as before: the method and nothing else', () => {
    expect(plan({ policy: NONE }).body).toEqual({ paymentMethod: 'cash' });
    expect(plan({ policy: CARD_ONLY, receivedText: '1200' })).toMatchObject({
      body: { paymentMethod: 'cash' },
      tip: 0,
    });
    expect(plan({ policy: ALL, paymentMethod: 'check' }).body).toEqual({ paymentMethod: 'check' });
  });

  it('sends the bill it was looking at, and no tip, when the box is blank', () => {
    expect(plan({})).toEqual({
      body: { paymentMethod: 'cash', expectedTotal: 1000 },
      problem: null,
      tip: 0,
      tipMethod: null,
      eligible: [],
    });
  });

  it('sends the tip beside the bill, on the method it was paid by', () => {
    expect(plan({ paymentMethod: 'card', receivedText: '1150' })).toMatchObject({
      body: { paymentMethod: 'card', expectedTotal: 1000, tipAmount: 150, tipMethod: 'card' },
      problem: null,
      tip: 150,
      tipMethod: 'card',
    });
  });

  it('cannot be taken when less than the bill was received', () => {
    const short = plan({ receivedText: '900' });
    expect(short.body).toBeNull();
    expect(short.problem).toMatch(/less than the bill/);
  });
});

describe('planSettlement — split', () => {
  const split = (cash: number, card: number, online = 0) => ({ cash, card, online });

  it('still needs the parts to reach the bill', () => {
    const under = plan({ paymentMethod: 'partial', split: split(600, 300) });
    expect(under.body).toBeNull();
    expect(under.problem).toMatch(/add up to the bill/);
  });

  it('sends a split that adds up as it always did', () => {
    expect(plan({ paymentMethod: 'partial', split: split(600, 400) }).body).toEqual({
      paymentMethod: 'partial',
      split: split(600, 400),
    });
  });

  it('refuses an over-allocated split on a store that records no tips', () => {
    const over = plan({ paymentMethod: 'partial', policy: NONE, split: split(600, 500) });
    expect(over.body).toBeNull();
    expect(over.tip).toBe(0);
  });

  it('turns the excess into a tip and takes it back off the part it came by', () => {
    const tipped = plan({ paymentMethod: 'partial', split: split(600, 500), tipMethod: 'card' });
    expect(tipped.body).toEqual({
      paymentMethod: 'partial',
      // 600 + 400: the bill alone, which is what the server checks.
      split: split(600, 400),
      tipAmount: 100,
      tipMethod: 'card',
      expectedTotal: 1000,
    });
    expect(tipped.eligible).toEqual(['cash', 'card']);
  });

  it('assumes the first eligible method until the cashier picks one', () => {
    expect(plan({ paymentMethod: 'partial', split: split(600, 500) })).toMatchObject({
      tipMethod: 'cash',
      body: { split: split(500, 500), tipMethod: 'cash' },
    });
    // A pick that no longer fits falls back rather than sending nonsense.
    expect(
      plan({ paymentMethod: 'partial', policy: CARD_ONLY, split: split(600, 500), tipMethod: 'cash' }).tipMethod,
    ).toBe('card');
  });

  it('handles a bill on the card with the tip left in cash', () => {
    expect(plan({ paymentMethod: 'partial', split: split(100, 1000), tipMethod: 'cash' }).body).toEqual({
      paymentMethod: 'partial',
      split: split(0, 1000),
      tipAmount: 100,
      tipMethod: 'cash',
      expectedTotal: 1000,
    });
  });

  it('cannot be taken when the excess fits no single amount', () => {
    const odd = plan({ total: 100, paymentMethod: 'partial', split: { cash: 150, card: 150, online: 150 } });
    expect(odd.body).toBeNull();
    expect(odd.tip).toBe(350);
    expect(odd.problem).toMatch(/Check the figures/);
  });
});

describe('tipWasDropped', () => {
  it('notices a server that did not store the tip it was sent', () => {
    const sent = { paymentMethod: 'cash', tipAmount: 150 };
    expect(tipWasDropped(sent, { tipAmount: '150.00' })).toBe(false);
    expect(tipWasDropped(sent, {})).toBe(true);
    expect(tipWasDropped(sent, { tipAmount: '0.00' })).toBe(true);
    expect(tipWasDropped({ paymentMethod: 'cash' }, {})).toBe(false);
  });
});

describe('the tips dropdown', () => {
  it('reads the server’s breakdown and labels each line', () => {
    const cells = tipCells([
      { orderType: 'dine_in', method: 'cash', amount: '300.00' },
      { orderType: 'delivery', method: 'online', amount: 400 },
    ]);
    expect(cells.map(tipCellLabel)).toEqual(['Dine-in · Cash', 'Delivery · Online']);
    expect(cells[0].amount).toBe(300);
  });

  it('drops empty and malformed lines, and survives a server that sends none', () => {
    expect(tipCells(undefined)).toEqual([]);
    expect(
      tipCells([
        { orderType: 'dine_in', method: 'cash', amount: 0 },
        { orderType: 'picnic', method: 'cash', amount: 50 },
        // Not an order type, though every object has the key.
        { orderType: 'toString', method: 'cash', amount: 50 },
        { orderType: 'takeaway', method: 'check', amount: 50 },
      ]),
    ).toEqual([]);
  });
});
