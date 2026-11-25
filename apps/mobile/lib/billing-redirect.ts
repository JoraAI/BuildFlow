/**
 * Global handler for HTTP 402 / PAYMENT_REQUIRED.
 * Navigates expired / plan-capped users to the product billing screen.
 */
import { router } from 'expo-router';
import { getAppVariant } from '@/constants/app-variant';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/components/ui';

export const INVENTORY_BILLING_HREF = '/inventory/settings';
export const CONSTRUCTION_BILLING_HREF = '/(app)/settings/billing';

const DEBOUNCE_MS = 3000;

let lastRedirectAt = 0;

/** Reset debounce (tests). */
export function resetBillingRedirectDebounce(): void {
  lastRedirectAt = 0;
}

export function resolveBillingHref(opts?: {
  pathname?: string;
  productMode?: string | null;
}): string {
  const variant = getAppVariant();
  if (variant === 'inventory') return INVENTORY_BILLING_HREF;
  if (variant === 'construction') return CONSTRUCTION_BILLING_HREF;

  const path =
    opts?.pathname ??
    (typeof window !== 'undefined' && typeof window.location?.pathname === 'string'
      ? window.location.pathname
      : '');
  if (path.includes('/inventory')) return INVENTORY_BILLING_HREF;

  const mode = opts?.productMode ?? useAuthStore.getState().user?.productMode;
  if (mode === 'inventory') return INVENTORY_BILLING_HREF;
  return CONSTRUCTION_BILLING_HREF;
}

export function isOnBillingScreen(pathname?: string): boolean {
  const path =
    pathname ??
    (typeof window !== 'undefined' && typeof window.location?.pathname === 'string'
      ? window.location.pathname
      : '');
  if (!path) return false;
  const normalized = path.replace(/\/$/, '') || '/';
  return (
    normalized === '/inventory/settings' ||
    normalized.startsWith('/inventory/settings/') ||
    normalized.endsWith('/settings/billing') ||
    normalized.includes('/settings/billing')
  );
}

/**
 * Toast + navigate to billing. Safe to call from apiFetch (outside React).
 * Still rethrow the original error at the call site so busy/UI state clears.
 */
export function handlePaymentRequired(message?: string): void {
  const href = resolveBillingHref();
  if (isOnBillingScreen()) return;

  const now = Date.now();
  if (now - lastRedirectAt < DEBOUNCE_MS) return;
  lastRedirectAt = now;

  const copy =
    message?.trim() ||
    'Your subscription requires attention. Opening Billing so you can renew or upgrade.';
  toast.warning(copy, 4500);

  try {
    router.push(href as never);
  } catch {
    // Router may not be mounted during early boot; ignore.
  }
}

export function isPaymentRequiredError(err: {
  status?: number;
  code?: string;
}): boolean {
  return err.status === 402 || err.code === 'PAYMENT_REQUIRED';
}
