/**
 * BuildFlow — BOQ React Query hooks.
 */
import { useQuery } from '@tanstack/react-query';
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

export function useBoq(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'boq'] as const,
    queryFn: () => apiFetch<BoqListResponse>(`/projects/${projectId}/boq`),
    enabled: !!projectId,
  });
}