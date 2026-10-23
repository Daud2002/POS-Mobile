import {
  daysUntil,
  formatExpiry,
  parseIsoDay,
  subscriptionAlert,
  subscriptionMessage,
} from '../subscription';

// A fixed "now", late in the evening so UTC-vs-local mistakes would show.
const today = new Date(2026, 9, 21, 23, 30);

describe('parseIsoDay / daysUntil', () => {
  it('reads the date as a local calendar day', () => {
    const d = parseIsoDay('2026-10-21')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 21]);
    expect(parseIsoDay('2026-02-30')).toBeNull();
    expect(parseIsoDay('')).toBeNull();
    expect(parseIsoDay(undefined)).toBeNull();
  });

  it('counts whole days regardless of the time of day', () => {
    expect(daysUntil('2026-10-24', today)).toBe(3);
    expect(daysUntil('2026-10-21', today)).toBe(0);
    expect(daysUntil('2026-10-19', today)).toBe(-2);
    expect(daysUntil(null, today)).toBeNull();
  });
});

describe('subscriptionAlert', () => {
  it('is silent with no date (including an API that predates the field), and until three days out', () => {
    expect(subscriptionAlert(undefined, today).level).toBe('none');
    expect(subscriptionAlert(null, today).level).toBe('none');
    expect(subscriptionAlert('2027-01-01', today).level).toBe('none');
    expect(subscriptionAlert('2026-10-25', today).level).toBe('none');
  });

  it('turns yellow at 3 and 2 days, red from 1 day through expiry and beyond', () => {
    expect(subscriptionAlert('2026-10-24', today).level).toBe('warning');
    expect(subscriptionAlert('2026-10-23', today).level).toBe('warning');
    expect(subscriptionAlert('2026-10-22', today).level).toBe('critical');
    expect(subscriptionAlert('2026-10-21', today).level).toBe('critical');
    expect(subscriptionAlert('2026-09-01', today).level).toBe('critical');
  });

  it('says what to do', () => {
    expect(subscriptionMessage(subscriptionAlert('2026-10-24', today))).toBe(
      'Your subscription expires in 3 days (24 Oct 2026). Please contact TapNtrade to renew.',
    );
    expect(subscriptionMessage(subscriptionAlert('2026-10-22', today))).toBe(
      'Your subscription expires tomorrow (22 Oct 2026). Please contact TapNtrade to renew.',
    );
    expect(subscriptionMessage(subscriptionAlert('2026-10-21', today))).toBe(
      'Your subscription expires today (21 Oct 2026). Please contact TapNtrade to renew.',
    );
    expect(subscriptionMessage(subscriptionAlert('2026-10-01', today))).toBe(
      'Your subscription expired on 1 Oct 2026. Please contact TapNtrade to renew.',
    );
    expect(subscriptionMessage(subscriptionAlert(null, today))).toBeNull();
    expect(formatExpiry(null)).toBe('—');
  });
});
