import {
  countsAsRevenue,
  creditCustomerOf,
  isCreditOwing,
  isCreditSale,
  sortCreditOrders,
} from '../creditSales';

describe('creditCustomerOf', () => {
  it('sends a picked customer by id', () => {
    expect(creditCustomerOf({ mode: 'find', picked: { id: 'c1' }, name: '', phone: '' })).toEqual({
      customerId: 'c1',
    });
  });

  it('waits until somebody is picked', () => {
    expect(creditCustomerOf({ mode: 'find', picked: null, name: 'Ahmed', phone: '0300' })).toBeNull();
  });

  it('needs a phone for a new customer, and names them if the name is blank', () => {
    expect(creditCustomerOf({ mode: 'new', picked: null, name: 'Ahmed', phone: '  ' })).toBeNull();
    expect(creditCustomerOf({ mode: 'new', picked: null, name: ' ', phone: ' 0300-1234567 ' })).toEqual({
      customerName: 'Customer',
      customerPhone: '0300-1234567',
    });
  });
});

describe('credit status', () => {
  const owed = { orderStatus: 'completed', paymentStatus: 'unpaid', creditedAt: '2026-11-04T10:00:00Z' };
  const collected = { ...owed, paymentStatus: 'paid' };
  const settled = { orderStatus: 'completed', paymentStatus: 'paid', creditedAt: null };

  it('tells an owed credit order from a collected one', () => {
    expect(isCreditSale(owed)).toBe(true);
    expect(isCreditOwing(owed)).toBe(true);
    expect(isCreditOwing(collected)).toBe(false);
    expect(isCreditSale(settled)).toBe(false);
  });

  it('leaves only uncollected credit out of revenue', () => {
    expect(countsAsRevenue(owed)).toBe(false);
    expect(countsAsRevenue(collected)).toBe(true);
    expect(countsAsRevenue(settled)).toBe(true);
    expect(countsAsRevenue({ orderStatus: 'preparing', paymentStatus: 'unpaid' })).toBe(false);
  });
});

describe('sortCreditOrders', () => {
  it('puts what is owed first, then paid, each newest first', () => {
    const orders = [
      { id: 'paid-old', paymentStatus: 'paid', creditedAt: '2026-10-01T10:00:00Z' },
      { id: 'owed-old', paymentStatus: 'unpaid', creditedAt: '2026-10-02T10:00:00Z' },
      { id: 'paid-new', paymentStatus: 'paid', creditedAt: '2026-11-03T10:00:00Z' },
      { id: 'owed-new', paymentStatus: 'unpaid', creditedAt: '2026-11-04T10:00:00Z' },
    ];
    expect(sortCreditOrders(orders).map((o) => o.id)).toEqual(['owed-new', 'owed-old', 'paid-new', 'paid-old']);
  });
});
