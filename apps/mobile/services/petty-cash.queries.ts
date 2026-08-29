/**
 * BuildFlow - Petty Cash / Site Expenses React Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchList } from '@/lib/api-client';

export interface PettyCashEntry {
  id: string;
  entryNumber: string;
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
  paidTo: string;
  receiptUrl: string | null;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECONCILED';
  project?: { id: string; name: string } | null;
}

export interface PettyCashSummary {
  totalAmount: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  count: number;
}

export interface CreatePettyCashInput {
  projectId?: string | null;
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
  paidTo: string;
  receiptUrl?: string | null;
  notes?: string | null;
}

export interface UpdatePettyCashInput {
  description?: string;
  category?: string;
  amount?: number;
  expenseDate?: string;
  paidTo?: string;
  receiptUrl?: string | null;
  notes?: string | null;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECONCILED';
}

export const pettyCashKeys = {
  all: ['petty-cash'] as const,
  lists: () => [...pettyCashKeys.all, 'list'] as const,
  list: (projectId?: string, category?: string, status?: string) =>
    [...pettyCashKeys.lists(), { projectId, category, status }] as const,
  summaries: () => [...pettyCashKeys.all, 'summary'] as const,
  summary: (projectId?: string) => [...pettyCashKeys.summaries(), projectId] as const,
  detail: (id: string) => [...pettyCashKeys.all, 'detail', id] as const,
};

export function usePettyCashEntries(params?: {
  projectId?: string;
  category?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.projectId) query.set('projectId', params.projectId);
  if (params?.category) query.set('category', params.category);
  if (params?.status) query.set('status', params.status);
  query.set('page', String(params?.page ?? 1));
  query.set('limit', String(params?.limit ?? 100));

  return useQuery({
    queryKey: pettyCashKeys.list(params?.projectId, params?.category, params?.status),
    queryFn: () =>
      apiFetchList<PettyCashEntry>(`/petty-cash?${query.toString()}`),
  });
}

export function usePettyCashSummary(projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return useQuery({
    queryKey: pettyCashKeys.summary(projectId),
    queryFn: () => apiFetch<PettyCashSummary>(`/petty-cash/summary${query}`),
  });
}

export function useCreatePettyCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePettyCashInput) =>
      apiFetch<PettyCashEntry>('/petty-cash', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pettyCashKeys.all });
    },
  });
}

export function useUpdatePettyCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdatePettyCashInput & { id: string }) =>
      apiFetch<PettyCashEntry>(`/petty-cash/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pettyCashKeys.all });
    },
  });
}

export function useDeletePettyCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/petty-cash/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pettyCashKeys.all });
    },
  });
}
