/**
 * BuildFlow — Project React Query hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { CreateProjectInput, UpdateProjectInput, ProjectStats, Role } from '@buildflow/shared';

export interface ProjectListItem {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  clientName: string;
  startDate: string | null;
  endDate: string | null;
  budget: string;
  createdAt: string;
  _count?: { tasks: number };
}

export type ProjectSummary = ProjectStats;

export interface ProjectDetail extends ProjectListItem {
  clientContact: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationAddress: string | null;
  summary?: ProjectSummary;
}

export interface ProjectMemberRow {
  id: string;
  userId: string;
  role: Role;
  user: { id: string; name: string; email: string; role: Role };
}

const KEYS = {
  list: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  summary: (id: string) => ['projects', id, 'summary'] as const,
  members: (id: string) => ['projects', id, 'members'] as const,
  wbs: (id: string) => ['projects', id, 'wbs'] as const,
  gantt: (id: string) => ['projects', id, 'gantt'] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: () => apiFetch<ProjectListItem[]>('/projects'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => apiFetch<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useProjectSummary(id: string) {
  return useQuery({
    queryKey: KEYS.summary(id),
    queryFn: () => apiFetch<ProjectSummary>(`/projects/${id}/summary`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiFetch<ProjectDetail>('/projects', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      apiFetch<ProjectDetail>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: KEYS.members(projectId),
    queryFn: () => apiFetch<ProjectMemberRow[]>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
}

export function useSetProjectMembers(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { members: Array<{ userId: string; role: Role }> }) =>
      apiFetch<ProjectMemberRow[]>(`/projects/${projectId}/members`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.members(projectId) });
    },
  });
}

/* ---------------- WBS ---------------- */

export interface WBSNode {
  id: string;
  code: string;
  name: string;
  level: number;
  orderIndex: number;
  parentId: string | null;
  children?: WBSNode[];
}

export function useWbs(projectId: string) {
  return useQuery({
    queryKey: KEYS.wbs(projectId),
    queryFn: () => apiFetch<WBSNode[]>(`/projects/${projectId}/wbs`),
    enabled: !!projectId,
  });
}

/* ---------------- Gantt ---------------- */

export interface GanttTask {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  progressPct: number;
  status: string;
  isCritical: boolean;
  wbsName?: string;
}

export interface GanttData {
  tasks: GanttTask[];
  criticalPath: string[];
  projectStart: string | null;
  projectEnd: string | null;
}

export function useGantt(projectId: string) {
  return useQuery({
    queryKey: KEYS.gantt(projectId),
    queryFn: () => apiFetch<GanttData>(`/projects/${projectId}/gantt`),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  });
}