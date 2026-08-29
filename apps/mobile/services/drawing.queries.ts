/**
 * BuildFlow - Drawing & Blueprint Suite React Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchList } from '@/lib/api-client';

export interface DrawingVersion {
  id: string;
  drawingId: string;
  versionLabel: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  notes?: string | null;
  uploadedAt: string;
  uploadedByUser?: { id: string; name: string };
}

export interface Drawing {
  id: string;
  projectId: string;
  drawingNo: string;
  title: string;
  discipline: 'ARCHITECTURAL' | 'STRUCTURAL' | 'MEP' | 'CIVIL' | 'OTHER';
  category?: string | null;
  status: 'DRAFT' | 'FOR_REVIEW' | 'APPROVED' | 'SUPERSEDED' | 'REJECTED';
  currentVersionId?: string | null;
  currentVersion?: DrawingVersion | null;
  versions?: DrawingVersion[];
  _count?: { versions: number };
  createdAt: string;
  project?: { id: string; name: string };
}

export interface CreateDrawingInput {
  projectId: string;
  drawingNo: string;
  title: string;
  discipline: string;
  category?: string | null;
}

export interface UpdateDrawingInput {
  title?: string;
  discipline?: string;
  category?: string | null;
  status?: string;
}

export interface AddDrawingVersionInput {
  versionLabel: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  notes?: string | null;
}

export const drawingKeys = {
  all: ['drawings'] as const,
  lists: () => [...drawingKeys.all, 'list'] as const,
  list: (projectId?: string, discipline?: string, status?: string) =>
    [...drawingKeys.lists(), { projectId, discipline, status }] as const,
  detail: (id: string) => [...drawingKeys.all, 'detail', id] as const,
};

export function useDrawings(params?: {
  projectId?: string;
  discipline?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.projectId) query.set('projectId', params.projectId);
  if (params?.discipline) query.set('discipline', params.discipline);
  if (params?.status) query.set('status', params.status);
  query.set('page', String(params?.page ?? 1));
  query.set('limit', String(params?.limit ?? 100));

  return useQuery({
    queryKey: drawingKeys.list(params?.projectId, params?.discipline, params?.status),
    queryFn: () => apiFetchList<Drawing>(`/drawings?${query.toString()}`),
  });
}

export function useDrawing(id?: string) {
  return useQuery({
    queryKey: drawingKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Drawing>(`/drawings/${id}`),
    enabled: !!id,
  });
}

export function useCreateDrawing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDrawingInput) =>
      apiFetch<Drawing>('/drawings', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: drawingKeys.all });
    },
  });
}

export function useUpdateDrawing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateDrawingInput & { id: string }) =>
      apiFetch<Drawing>(`/drawings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: drawingKeys.all });
    },
  });
}

export function useAddDrawingVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AddDrawingVersionInput & { id: string }) =>
      apiFetch<DrawingVersion>(`/drawings/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: drawingKeys.all });
    },
  });
}
