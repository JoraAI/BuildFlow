/**
 * Ice cream manufacturer + B2B staff API hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

const keys = {
  recipes: ['ice-cream', 'recipes'] as const,
  production: ['ice-cream', 'production'] as const,
  buyers: ['ice-cream', 'buyers'] as const,
  salesDashboard: ['ice-cream', 'sales-dashboard'] as const,
};

export type RecipeRow = {
  id: string;
  name: string;
  outputQty: string | number;
  notes?: string | null;
  isActive: boolean;
  outputResource: { id: string; name: string; unit: string; sku?: string | null };
  lines: Array<{
    id: string;
    quantity: string | number;
    inputResource: { id: string; name: string; unit: string; sku?: string | null };
  }>;
};

export type ProductionRow = {
  id: string;
  batchCode: string;
  outputQty: string | number;
  status: string;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
  recipe: {
    id: string;
    name: string;
    outputResource: { id: string; name: string; unit: string };
  };
  location: { id: string; name: string; code?: string | null };
};

export function useRecipes(enabled = true) {
  return useQuery({
    queryKey: keys.recipes,
    enabled,
    queryFn: () => apiFetch<RecipeRow[]>('/inventory/ice-cream/recipes'),
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      outputResourceId: string;
      outputQty: number;
      notes?: string;
      lines: Array<{ inputResourceId: string; quantity: number }>;
    }) =>
      apiFetch<RecipeRow>('/inventory/ice-cream/recipes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recipes }),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      outputResourceId?: string;
      outputQty?: number;
      notes?: string | null;
      isActive?: boolean;
      lines?: Array<{ inputResourceId: string; quantity: number }>;
    }) =>
      apiFetch<RecipeRow>(`/inventory/ice-cream/recipes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recipes }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ mode: 'deleted' | 'deactivated'; id?: string; batchCount?: number }>(
        `/inventory/ice-cream/recipes/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.recipes });
      qc.invalidateQueries({ queryKey: keys.production });
    },
  });
}

export function useProductionBatches(enabled = true) {
  return useQuery({
    queryKey: keys.production,
    enabled,
    queryFn: () => apiFetch<ProductionRow[]>('/inventory/ice-cream/production'),
  });
}

export function useCreateProductionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      recipeId: string;
      outputQty: number;
      batchCode: string;
      manufacturedAt?: string;
      expiresAt?: string;
      notes?: string;
      locationId?: string;
    }) =>
      apiFetch<ProductionRow>('/inventory/ice-cream/production', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.production }),
  });
}

export function useCompleteProductionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ProductionRow>(`/inventory/ice-cream/production/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.production });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useSalesDashboard(enabled = true) {
  return useQuery({
    queryKey: keys.salesDashboard,
    enabled,
    queryFn: () =>
      apiFetch<{
        totals: {
          orderCount: number;
          orderValue: number;
          b2bOrderCount: number;
          b2bOrderValue: number;
          draftCount: number;
          confirmedCount: number;
          deliveredCount: number;
          invoicedCount: number;
        };
        recent: Array<{
          id: string;
          soNumber: string;
          customerName: string;
          status: string;
          source: string;
          total: string | number;
          createdAt: string;
        }>;
      }>('/inventory/ice-cream/sales-dashboard'),
  });
}

export function useInviteBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      customerId: string;
      email: string;
      name?: string;
      phone?: string;
    }) =>
      apiFetch('/inventory/ice-cream/buyers/invite', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.buyers }),
  });
}

export function useSetB2bPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { resourceId: string; published: boolean }) =>
      apiFetch('/inventory/ice-cream/catalog/publish', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}
