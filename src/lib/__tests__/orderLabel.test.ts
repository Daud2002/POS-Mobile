import { orderTypeLabel, serviceLabel } from '../orderLabel';

describe('serviceLabel', () => {
  it('reads a table order off its lines', () => {
    expect(serviceLabel('dine_in', [{ isParcel: false }])).toBe('DINE-IN');
    expect(serviceLabel('dine_out', [{ isParcel: true }, { isParcel: false }])).toBe(
      'DINE-IN + PARCEL',
    );
    expect(serviceLabel('dine_out', [{ isParcel: true }, { isParcel: true }])).toBe('PARCEL');
  });

  it('trusts the lines over a stale stored type', () => {
    expect(serviceLabel('dine_out', [{ isParcel: false }])).toBe('DINE-IN');
    expect(serviceLabel('dine_in', [{ isParcel: true }])).toBe('PARCEL');
  });

  it('keeps takeaway and delivery, and prints nothing for no type', () => {
    expect(serviceLabel('takeaway', [])).toBe('TAKEAWAY');
    expect(serviceLabel('delivery', [{ isParcel: true }])).toBe('DELIVERY');
    expect(serviceLabel('none', [])).toBe('');
    expect(serviceLabel(undefined, [])).toBe('');
  });

  it('never calls anything dine-out', () => {
    expect(orderTypeLabel('dine_out')).toBe('Parcel');
  });
});
