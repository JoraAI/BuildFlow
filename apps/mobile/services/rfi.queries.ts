/**
 * BuildFlow - RFI & Submittal React Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchList } from '@/lib/api-client';

export type RfiPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type RfiStatus = 'OPEN' | 'ANSWERED' | 'CLOSED' | 'CANCELLED';
export type SubmittalType = 'MATERIAL' | 'SHOP_DRAWING' | 'METHOD_STATEMENT' | 'OTHER';
export type SubmittalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVISE';

export interface RfiItem {
  id: string;
  projectId: string;
  rfiNumber: string;
  subject: string;
  question: string;
  answer?: string | null;
  status: RfiStatus;
  priority: RfiPriority;
  dueDate?: string | null;
  createdAt: string;
  answeredAt?: string | null;
  raisedByUser?: { id: string; name: string } | null;
  answeredByUser?: { id: string; name: string } | null;
}

export interface SubmittalItem {
  id: string;
  projectId: string;
  submittalNo: string;
  title: string;
  description?: string | null;
  type: SubmittalType;
  status: SubmittalStatus;
  reviewNotes?: string | null;
  dueDate?: string | null;
  createdAt: string;
  submittedByUser?: { id: string; name: string } | null;
  reviewedByUser?: { id: string; name: string } | null;
}

export interface CreateRfiInput {
  projectId: string;
  subject: string;
  question: string;
  priority?: RfiPriority;
  dueDate?: string;
}

export interface CreateSubmittalInput {
  projectId: string;
  title: string;
  description?: string;
  type?: SubmittalType;
  dueDate?: string;
}

export const rfiKeys = {
  all: ['rfis'] as const,
  list: (projectId?: string, status?: string) =>
    [...rfiKeys.all, 'list', { projectId, status }] as const,
};

export const submittalKeys = {
  all: ['submittals'] as const,
  list: (projectId?: string, status?: string) =>
    [...submittalKeys.all, 'list', { projectId, status }] as const,
};

export function useRfis(params?: { projectId?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.projectId) query.set('projectId', params.projectId);
  if (params?.status) query.set('status', params.status);
  query.set('page', '1');
  query.set('limit', '100');

  return useQuery({
    queryKey: rfiKeys.list(params?.projectId, params?.status),
    queryFn: () => apiFetchList<RfiItem>(`/rfis?${query.toString()}`),
  });
}

export function useCreateRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRfiInput) =>
      apiFetch<RfiItem>('/rfis', {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          attachments: [],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rfiKeys.all });
    },
  });
}

export function useAnswerRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      apiFetch<RfiItem>(`/rfis/${id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rfiKeys.all });
    },
  });
}

export function useCloseRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RfiItem>(`/rfis/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'CLOSED' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rfiKeys.all });
    },
  });
}

export function useSubmittals(params?: { projectId?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.projectId) query.set('projectId', params.projectId);
  if (params?.status) query.set('status', params.status);
  query.set('page', '1');
  query.set('limit', '100');

  return useQuery({
    queryKey: submittalKeys.list(params?.projectId, params?.status),
    queryFn: () => apiFetchList<SubmittalItem>(`/submittals?${query.toString()}`),
  });
}

export function useCreateSubmittal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubmittalInput) =>
      apiFetch<SubmittalItem>('/submittals', {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          attachments: [],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all });
    },
  });
}

export function useSubmitSubmittal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SubmittalItem>(`/submittals/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'SUBMITTED' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all });
    },
  });
}

export function useReviewSubmittal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reviewNotes,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED' | 'REVISE';
      reviewNotes?: string;
    }) =>
      apiFetch<SubmittalItem>(`/submittals/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, reviewNotes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all });
    },
  });
}
