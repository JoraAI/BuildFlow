import { getAppVariant, isNativeProductLocked } from '@/constants/app-variant';

export type ProductMode = 'construction' | 'inventory' | undefined | null;

/** Post-login home for web / matching native variant. */
export function homeHrefForProduct(productMode: ProductMode): '/inventory' | '/dashboard' {
  return productMode === 'inventory' ? '/inventory' : '/dashboard';
}

/**
 * Native BuildFlow Inventory must not open construction shell (and vice versa).
 * Web never mismatches — both shells ship in one SPA.
 */
export function isProductMismatch(productMode: ProductMode): boolean {
  if (!isNativeProductLocked()) return false;
  const variant = getAppVariant();
  if (variant === 'inventory') return productMode !== 'inventory';
  if (variant === 'construction') return productMode === 'inventory';
  return false;
}
