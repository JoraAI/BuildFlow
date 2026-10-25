import { quoteSaasPayment } from '@buildflow/shared';

const now = new Date('2026-10-25T10:00:00.000Z');

describe('quoteSaasPayment inventory intervals', () => {
  it('charges full monthly after trial', () => {
    const quote = quoteSaasPayment({
      now,
      status: 'TRIAL',
      billingInterval: null,
      paidUntil: new Date('2026-11-08T10:00:00.000Z'),
      lastPaymentAt: null,
      plan: 'INVENTORY',
      requestedInterval: 'MONTHLY',
    });
    expect(quote.mode).toBe('new');
    expect(quote.amountInr).toBe(799);
    expect(quote.requiresPayment).toBe(true);
  });

  it('charges full yearly after the paid period ended', () => {
    const quote = quoteSaasPayment({
      now,
      status: 'PAST_DUE',
      billingInterval: 'MONTHLY',
      paidUntil: new Date('2026-10-20T10:00:00.000Z'),
      lastPaymentAt: new Date('2026-09-20T10:00:00.000Z'),
      plan: 'INVENTORY',
      requestedInterval: 'YEARLY',
    });
    expect(quote.mode).toBe('new');
    expect(quote.amountInr).toBe(7990);
    expect(quote.creditInr).toBe(0);
  });

  it('stacks the same frequency until after the current paid period', () => {
    const paidUntil = new Date('2026-11-10T10:00:00.000Z');
    const quote = quoteSaasPayment({
      now,
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      paidUntil,
      lastPaymentAt: new Date('2026-10-10T10:00:00.000Z'),
      plan: 'INVENTORY',
      requestedInterval: 'MONTHLY',
    });
    expect(quote.mode).toBe('extend');
    expect(quote.amountInr).toBe(799);
    expect(quote.periodStart).toBe(paidUntil.toISOString());
    expect(new Date(quote.periodEnd).getTime()).toBeGreaterThan(paidUntil.getTime());
  });

  it('credits unused monthly time when switching to yearly mid-cycle', () => {
    const quote = quoteSaasPayment({
      now,
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      paidUntil: new Date('2026-11-24T10:00:00.000Z'),
      lastPaymentAt: new Date('2026-10-25T10:00:00.000Z'),
      plan: 'INVENTORY',
      requestedInterval: 'YEARLY',
    });
    expect(quote.mode).toBe('upgrade_prorate');
    expect(quote.creditInr).toBeGreaterThan(0);
    expect(quote.amountInr).toBe(7990 - quote.creditInr);
    expect(quote.requiresPayment).toBe(true);
  });

  it('schedules yearly to monthly without charging or refunding', () => {
    const quote = quoteSaasPayment({
      now,
      status: 'ACTIVE',
      billingInterval: 'YEARLY',
      paidUntil: new Date('2027-06-01T10:00:00.000Z'),
      lastPaymentAt: new Date('2026-06-01T10:00:00.000Z'),
      plan: 'INVENTORY',
      requestedInterval: 'MONTHLY',
    });
    expect(quote.mode).toBe('schedule');
    expect(quote.amountInr).toBe(0);
    expect(quote.requiresPayment).toBe(false);
  });
});
