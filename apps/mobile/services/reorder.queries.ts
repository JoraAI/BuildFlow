/**
 * BuildFlow - Reorder automation hooks (INVENTORY_HORIZONTAL_PLATFORM Phase 4).
 * Low-stock suggestions + one-click purchase (auto-approved indent + PO).
 * Gated by `stock_adjustments` on the backend (construction 403).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface ReorderSuggestion {
  resourceId: string;
  name: string;
  unit: string;
  catalogRate: number;
  reorderPoint: number;
  onHand: number;
  suggestedQty: number;
  reorderQty: number | null;
  leadTimeDays: number | null;
  preferredVendor: { id: string; name: string; phone: string | null } | null;
}

export interface ReorderOrderResult {
  requisition: { id: string; reqNumber: string; status: string };
  purchaseOrder: { id: string; poNumber: string; status: string; totalAmount: string };
  suggestionCount: number;
}

export const reorderKeys = {
  suggestions: ['inventory', 'reorder', 'suggestions'] as const,
};

export function useReorderSuggestions() {
  return useQuery<ReorderSuggestion[]>({
    queryKey: reorderKeys.suggestions,
    queryFn: () => apiFetch<ReorderSuggestion[]>('/inventory/reorder/suggestions'),
  });
}

export function useOrderReorderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resourceIds: string[]) =>
      apiFetch<ReorderOrderResult>('/inventory/reorder/suggestions/order', {
        method: 'POST',
        body: JSON.stringify({ resourceIds }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reorderKeys.suggestions });
      void qc.invalidateQueries({ queryKey: ['procurement', 'requisitions'] });
      void qc.invalidateQueries({ queryKey: ['procurement', 'next-numbers'] });
    },
  });
}
