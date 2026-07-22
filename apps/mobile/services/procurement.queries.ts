/**
 * BuildFlow - Procurement React Query hooks (signatures, requisitions, POs).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// E-signatures on POs and Indents (requisitions)
// ---------------------------------------------------------------------------

export interface SignedDoc {
  id: string;
  signedBy: string | null;
  signedAt: string | null;
  signedByName: string | null;
  signatureHash: string | null;
}

export function useSignPO(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (poId: string) =>
      apiFetch<SignedDoc>(`/projects/${projectId}/procurement/po/${poId}/sign`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'procurement'] });
    },
  });
}

export function useSignRequisition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requisitionId: string) =>
      apiFetch<SignedDoc>(`/projects/${projectId}/procurement/requisitions/${requisitionId}/sign`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'procurement'] });
    },
  });
}

export function useVerifyPOSignature(projectId: string, poId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'procurement', 'po', poId, 'verify-signature'] as const,
    queryFn: () =>
      apiFetch<{ signed: boolean; valid?: boolean; signedBy?: string; signedByName?: string; signedAt?: string }>(
        `/projects/${projectId}/procurement/po/${poId}/verify-signature`,
      ),
    enabled: !!projectId && !!poId,
  });
}

// ---------------------------------------------------------------------------
// Variation BOQ picker (change orders)
// ---------------------------------------------------------------------------

export interface EligibleBoqItem {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  category: string | null;
  section: string | null;
}

export function useEligibleBoqItems(projectId: string, changeOrderId: string, search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return useQuery({
    queryKey: ['projects', projectId, 'change-orders', changeOrderId, 'eligible-boq', search ?? ''] as const,
    queryFn: () => apiFetch<EligibleBoqItem[]>(`/projects/${projectId}/change-orders/${changeOrderId}/eligible-boq${qs}`),
    enabled: !!projectId && !!changeOrderId,
  });
}

export function useAddBoqLinesToChangeOrder(projectId: string, changeOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (boqItemIds: string[]) =>
      apiFetch<{ id: string; lines: Array<{ id: string; description: string; qtyDelta: string; rate: string }> }>(
        `/projects/${projectId}/change-orders/${changeOrderId}/add-boq-lines`,
        { method: 'POST', body: JSON.stringify({ boqItemIds }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'change-orders'] });
    },
  });
}