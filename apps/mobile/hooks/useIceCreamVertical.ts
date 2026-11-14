/**
 * Manufacturer / role-pricing UI gates — prefer live company settings over
 * auth-store (which can be stale until re-login / refreshUser).
 */
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useCompany } from '@/services/settings.queries';
import { usesManufacturerFeatures, usesRoleBasedPricing } from '@buildflow/shared';

function useCompanyVertical(): string | null {
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { data: company } = useCompany();
  const companyVertical = company?.inventoryVertical ?? null;
  const userVertical = user?.inventoryVertical ?? null;

  useEffect(() => {
    if (!companyVertical || !user) return;
    if (companyVertical !== userVertical) {
      void refreshUser().catch(() => undefined);
    }
  }, [companyVertical, userVertical, user, refreshUser]);

  return companyVertical ?? userVertical;
}

/** Recipes, production tab, buyer-app publish/invite. */
export function useManufacturerVertical(): boolean {
  return usesManufacturerFeatures(useCompanyVertical());
}

/** @deprecated use useManufacturerVertical */
export function useIceCreamVertical(): boolean {
  return useManufacturerVertical();
}

/** Distributor + customer sell prices (wholesaler + manufacturer). */
export function useRoleBasedPricing(): boolean {
  return usesRoleBasedPricing(useCompanyVertical());
}
