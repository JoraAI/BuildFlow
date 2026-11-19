/**
 * Shop unit catalog (IM multi-unit).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export type CompanyUnit = {
  id: string;
  companyId: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
};

export function useCompanyUnits(includeInactive = false) {
  return useQuery({
    queryKey: ['inventory', 'units', includeInactive],
    queryFn: () =>
      apiFetch<CompanyUnit[]>(
        `/inventory/units${includeInactive ? '?includeInactive=true' : ''}`,
      ),
  });
}

export function useCreateCompanyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; symbol?: string | null }) =>
      apiFetch<CompanyUnit>('/inventory/units', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'units'] }),
  });
}

export function useUpdateCompanyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      symbol?: string | null;
      isActive?: boolean;
    }) =>
      apiFetch<CompanyUnit>(`/inventory/units/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'units'] }),
  });
}

export function useDeactivateCompanyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CompanyUnit>(`/inventory/units/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'units'] }),
  });
}
