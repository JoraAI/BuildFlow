/**
 * BuildFlow - Snag List & Visual NCR Quality Hub React Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchList } from '@/lib/api-client';

export type SnagPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SnagStatus = 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'CLOSED';

export interface SnagItem {
  id: string;
  projectId: string;
  taskId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  priority: SnagPriority;
  status: SnagStatus;
  assignedTo?: string | null;
  dueDate?: string | null;
  photos: string[];
  beforePhoto?: string | null;
  afterPhoto?: string | null;
  createdAt: string;
  closedAt?: string | null;
  project?: { id: string; name: string };
  assignee?: { id: string; name: string } | null;
  creator?: { id: string; name: string };
}

export interface CreateSnagInput {
  projectId: string;
  taskId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  priority: SnagPriority;
  assignedTo?: string | null;
  dueDate?: string | null;
  photos?: string[];
}

export interface UpdateSnagInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  priority?: SnagPriority;
  status?: SnagStatus;
  assignedTo?: string | null;
  dueDate?: string | null;
  photos?: string[];
}

export const snagKeys = {
  all: ['punch-list'] as const,
  lists: () => [...snagKeys.all, 'list'] as const,
  list: (projectId?: string, status?: string, priority?: string) =>
    [...snagKeys.lists(), { projectId, status, priority }] as const,
  detail: (id: string) => [...snagKeys.all, 'detail', id] as const,
};

export function useSnagItems(params?: {
  projectId?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.projectId) query.set('projectId', params.projectId);
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  query.set('page', String(params?.page ?? 1));
  query.set('limit', String(params?.limit ?? 100));

  return useQuery({
    queryKey: snagKeys.list(params?.projectId, params?.status, params?.priority),
    queryFn: () => apiFetchList<SnagItem>(`/punch-list?${query.toString()}`),
  });
}

export function useSnagItem(id?: string) {
  return useQuery({
    queryKey: snagKeys.detail(id ?? ''),
    queryFn: () => apiFetch<SnagItem>(`/punch-list/${id}`),
    enabled: !!id,
  });
}

export function useCreateSnag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSnagInput) =>
      apiFetch<SnagItem>('/punch-list', {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          photos: input.photos ?? [],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: snagKeys.all });
    },
  });
}

export function useUpdateSnag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateSnagInput & { id: string }) =>
      apiFetch<SnagItem>(`/punch-list/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: snagKeys.all });
    },
  });
}

export function useDeleteSnag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/punch-list/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: snagKeys.all });
    },
  });
}
