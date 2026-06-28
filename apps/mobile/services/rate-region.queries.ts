/**
 * BuildFlow - React Query hooks for rate regions.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface RateRegionRow {
  id: string;
  name: string;
  state: string | null;
  ratesCount: number;
  projectsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegionalRateRow {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  rate: number;
  unit: string;
  effectiveDate: string;
  notes: string | null;
}

export interface ProjectMaterialRateRow {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  rate: number;
  unit: string;
  notes: string | null;
  updatedAt: string;
}

export const rateRegionKeys = {
  list: ['rate-regions'] as const,
  rates: (regionId: string) => ['rate-regions', regionId, 'rates'] as const,
  projectRates: (projectId: string) => ['projects', projectId, 'material-rates'] as const,
};

export function useRateRegions() {
  return useQuery({
    queryKey: rateRegionKeys.list,
    queryFn: () => apiFetch<RateRegionRow[]>('/settings/rate-regions'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; state?: string }) =>
      apiFetch<RateRegionRow>('/settings/rate-regions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rateRegionKeys.list }),
  });
}

export function useRegionalRates(regionId: string) {
  return useQuery({
    queryKey: rateRegionKeys.rates(regionId),
    queryFn: () => apiFetch<RegionalRateRow[]>(`/settings/rate-regions/${regionId}/rates`),
    enabled: !!regionId,
  });
}

export function useUpsertRegionalRates(regionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rates: Array<{ resourceId: string; rate: number; unit: string; effectiveDate: string; notes?: string }>) =>
      apiFetch<RegionalRateRow[]>(`/settings/rate-regions/${regionId}/rates`, {
        method: 'PUT',
        body: JSON.stringify({ rates }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rateRegionKeys.rates(regionId) });
      qc.invalidateQueries({ queryKey: rateRegionKeys.list });
    },
  });
}

export function useProjectMaterialRates(projectId: string) {
  return useQuery({
    queryKey: rateRegionKeys.projectRates(projectId),
    queryFn: () => apiFetch<ProjectMaterialRateRow[]>(`/projects/${projectId}/material-rates`),
    enabled: !!projectId,
  });
}

export function useUpsertProjectMaterialRates(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rates: Array<{ resourceId: string; rate: number; unit: string; notes?: string }>) =>
      apiFetch<ProjectMaterialRateRow[]>(`/projects/${projectId}/material-rates`, {
        method: 'PUT',
        body: JSON.stringify({ rates }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rateRegionKeys.projectRates(projectId) }),
  });
}

export function useCopyProjectRatesFromRegion(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ProjectMaterialRateRow[]>(`/projects/${projectId}/material-rates/copy-from-region`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rateRegionKeys.projectRates(projectId) }),
  });
}

export function useCopyProjectRatesFromEstimate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ProjectMaterialRateRow[]>(`/projects/${projectId}/material-rates/copy-from-estimate`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rateRegionKeys.projectRates(projectId) }),
  });
}
