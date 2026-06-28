/**
 * BuildFlow - BOQ React Query hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface BoqItem {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  category: string | null;
  sanctionedQty?: number;
  executedQty?: number;
  billedCumulativeQty?: number;
  balanceQty?: number;
  progressPct?: number;
  billableQty?: number;
}

export interface BoqGroup {
  category: string;
  amount: number;
}

export interface BoqListResponse {
  items: BoqItem[];
  grouped: BoqGroup[];
  total: number;
}

export interface BoqVsActualLine {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  category: string | null;
  sanctionedQty: number;
  executedQty: number;
  billedCumulativeQty: number;
  billableQty: number;
  progressPct: number;
  boqAmount: number;
  actualSpend: number;
  variance: number;
}

export interface ResourceUtilRow {
  resourceId: string;
  name: string;
  unit: string;
  type: string;
  planned: number;
  used: number;
  variance: number;
  usedPct: number;
}

export function useBoq(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'boq'] as const,
    queryFn: () => apiFetch<BoqListResponse>(`/projects/${projectId}/boq`),
    enabled: !!projectId,
  });
}

export function useBoqVsActual(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'boq', 'vs-actual'] as const,
    queryFn: () =>
      apiFetch<{ lines: BoqVsActualLine[]; categoryTotals: Array<{ category: string; actualSpend: number }> }>(
        `/projects/${projectId}/boq/vs-actual`,
      ),
    enabled: !!projectId,
  });
}

export function useResourceUtilization(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'resources', 'utilization'] as const,
    queryFn: () => apiFetch<ResourceUtilRow[]>(`/projects/${projectId}/resources/utilization`),
    enabled: !!projectId,
  });
}

export function useRecordBoqMeasurement(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      boqItemId,
      quantity,
      notes,
    }: {
      boqItemId: string;
      quantity: number;
      notes?: string;
    }) =>
      apiFetch<{ measurement: unknown; executedQty: number }>(`/boq/${boqItemId}/measurements`, {
        method: 'POST',
        body: JSON.stringify({ quantity, notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'boq', 'vs-actual'] });
    },
  });
}
