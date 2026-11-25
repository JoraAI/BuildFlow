import { isBillingExemptPath } from '../../middleware/auth';

describe('isBillingExemptPath', () => {
  it('allows subscription and notification routes while expired', () => {
    expect(isBillingExemptPath('/api/settings/subscription')).toBe(true);
    expect(isBillingExemptPath('/api/settings/subscription/checkout')).toBe(true);
    expect(isBillingExemptPath('/api/settings/tickets')).toBe(true);
    expect(isBillingExemptPath('/api/notifications')).toBe(true);
    expect(isBillingExemptPath('/api/notifications?page=1')).toBe(true);
    expect(isBillingExemptPath('/api/webhooks/saas/razorpay')).toBe(true);
  });

  it('blocks inventory and project mutations', () => {
    expect(isBillingExemptPath('/api/resources')).toBe(false);
    expect(isBillingExemptPath('/api/projects')).toBe(false);
    expect(isBillingExemptPath('/api/inventory/stock')).toBe(false);
  });
});
