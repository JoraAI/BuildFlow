/**
 * ICE_CREAM manufacturer UI gate — prefer live company settings over auth-store
 * (which can be stale until re-login / refreshUser).
 */
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useCompany } from '@/services/settings.queries';

export function useIceCreamVertical(): boolean {
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

  return (companyVertical ?? userVertical) === 'ICE_CREAM';
}
