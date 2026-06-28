/**
 * BuildFlow - Proposal React Query hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchList } from '@/lib/api-client';
import type {
  CreateProposalInput,
  UpdateProposalInput,
  PromoteProposalInput,
  ProposalStatus,
} from '@buildflow/shared';

export interface ProposalEstimateSummary {
  id: string;
  name: string;
  version: number;
  status: string;
  grandTotal: string;
  createdAt: string;
  approvedAt: string | null;
}

export interface ProposalListItem {
  id: string;
  title: string;
  clientName: string;
  clientContact: string | null;
  projectType: string;
  status: ProposalStatus;
  validUntil: string | null;
  temporaryProjectId: string;
  promotedProjectId: string | null;
  createdAt: string;
  updatedAt: string;
  temporaryProject?: {
    id: string;
    estimates: ProposalEstimateSummary[];
  };
}

export interface ProposalDetail extends ProposalListItem {
  notes: string | null;
  rejectionReason: string | null;
  temporaryProject: {
    id: string;
    code: string;
    name: string;
    isTemporary: boolean;
    budget: string;
    estimates: ProposalEstimateSummary[];
  };
  promotedProject: {
    id: string;
    code: string;
    name: string;
    status: string;
  } | null;
}

const KEYS = {
  list: ['proposals'] as const,
  detail: (id: string) => ['proposals', id] as const,
};

export function useProposals(status?: ProposalStatus) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: [...KEYS.list, status ?? 'all'] as const,
    queryFn: async () => {
      const { data } = await apiFetchList<ProposalListItem>(`/proposals${qs}`);
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => apiFetch<ProposalDetail>(`/proposals/${id}`),
    enabled: !!id,
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProposalInput) =>
      apiFetch<ProposalDetail>('/proposals', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useUpdateProposal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProposalInput) =>
      apiFetch<ProposalDetail>(`/proposals/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function usePromoteProposal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PromoteProposalInput) =>
      apiFetch<ProposalDetail>(`/proposals/${id}/promote`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/proposals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
