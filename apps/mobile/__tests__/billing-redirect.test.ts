/**
 * Billing redirect helper unit tests.
 */
import {
  resolveBillingHref,
  isOnBillingScreen,
  isPaymentRequiredError,
  handlePaymentRequired,
  resetBillingRedirectDebounce,
  INVENTORY_BILLING_HREF,
  CONSTRUCTION_BILLING_HREF,
} from '@/lib/billing-redirect';

const mockPush = jest.fn();
const mockToastWarning = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/constants/app-variant', () => ({
  getAppVariant: jest.fn(() => 'web'),
}));

jest.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: () => ({ user: { productMode: 'construction' } }),
  },
}));

jest.mock('@/components/ui', () => ({
  toast: {
    warning: (...args: unknown[]) => mockToastWarning(...args),
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

import { getAppVariant } from '@/constants/app-variant';

const getAppVariantMock = getAppVariant as jest.MockedFunction<typeof getAppVariant>;

describe('resolveBillingHref', () => {
  beforeEach(() => {
    getAppVariantMock.mockReturnValue('web');
  });

  it('uses inventory settings for inventory app variant', () => {
    getAppVariantMock.mockReturnValue('inventory');
    expect(resolveBillingHref()).toBe(INVENTORY_BILLING_HREF);
  });

  it('uses construction billing for construction app variant', () => {
    getAppVariantMock.mockReturnValue('construction');
    expect(resolveBillingHref()).toBe(CONSTRUCTION_BILLING_HREF);
  });

  it('uses inventory path on web dual product', () => {
    expect(resolveBillingHref({ pathname: '/inventory/materials' })).toBe(INVENTORY_BILLING_HREF);
  });

  it('falls back to construction billing on web', () => {
    expect(resolveBillingHref({ pathname: '/projects', productMode: 'construction' })).toBe(
      CONSTRUCTION_BILLING_HREF,
    );
  });

  it('uses productMode inventory when path is ambiguous', () => {
    expect(resolveBillingHref({ pathname: '/dashboard', productMode: 'inventory' })).toBe(
      INVENTORY_BILLING_HREF,
    );
  });
});

describe('isOnBillingScreen', () => {
  it('detects inventory settings', () => {
    expect(isOnBillingScreen('/inventory/settings')).toBe(true);
  });

  it('detects construction billing', () => {
    expect(isOnBillingScreen('/settings/billing')).toBe(true);
  });

  it('rejects unrelated paths', () => {
    expect(isOnBillingScreen('/inventory/materials')).toBe(false);
  });
});

describe('isPaymentRequiredError', () => {
  it('matches status 402 or PAYMENT_REQUIRED code', () => {
    expect(isPaymentRequiredError({ status: 402 })).toBe(true);
    expect(isPaymentRequiredError({ code: 'PAYMENT_REQUIRED' })).toBe(true);
    expect(isPaymentRequiredError({ status: 400, code: 'BAD_REQUEST' })).toBe(false);
  });
});

describe('handlePaymentRequired', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockToastWarning.mockClear();
    resetBillingRedirectDebounce();
    getAppVariantMock.mockReturnValue('inventory');
    // Pretend we are not already on billing (no window path in jest).
  });

  it('toasts and navigates once, then debounces', () => {
    handlePaymentRequired('Expired');
    handlePaymentRequired('Expired again');
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(INVENTORY_BILLING_HREF);
  });
});
