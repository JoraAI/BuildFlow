/**
 * Native install flavor. Web / unset = both products (current SPA behavior).
 * Set at build time via EXPO_PUBLIC_APP_VARIANT on EAS profiles.
 */
export type AppVariant = 'construction' | 'inventory' | 'web';

export function getAppVariant(): AppVariant {
  const raw = (process.env.EXPO_PUBLIC_APP_VARIANT ?? '').trim().toLowerCase();
  if (raw === 'inventory' || raw === 'construction') return raw;
  return 'web';
}

/** True when this binary is locked to one product (Play listings). */
export function isNativeProductLocked(): boolean {
  const v = getAppVariant();
  return v === 'construction' || v === 'inventory';
}

export function appDisplayName(variant: AppVariant = getAppVariant()): string {
  return variant === 'inventory' ? 'BuildFlow Inventory' : 'BuildFlow';
}

export function otherProductAppName(variant: AppVariant = getAppVariant()): string {
  return variant === 'inventory' ? 'BuildFlow' : 'BuildFlow Inventory';
}
