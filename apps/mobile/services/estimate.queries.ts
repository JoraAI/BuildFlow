/**
 * BuildFlow — React Query hooks for Resources, Rate Analysis & Estimates.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiDownload } from '@/lib/api-client';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { API_BASE_URL, SECURE_STORE_KEYS } from '@/constants';
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Types (mirror backend shapes)
// ---------------------------------------------------------------------------

export interface Resource {
  id: string;
  name: string;
  type: 'LABOUR' | 'MATERIAL' | 'EQUIPMENT' | 'SUBCONTRACTOR';
  unit: string;
  rate: string;
  gstRate: string;
  hsnSacCode: string | null;
  category: string | null;
  lastRateUpdatedAt: string | null;
  isActive: boolean;
}

export interface PriceHistoryPoint {
  id: string;
  rate: string;
  effectiveDate: string;
  notes: string | null;
  recordedBy: string;
}

export interface RateAnalysisComponent {
  id: string;
  resourceId: string | null;
  resource?: { name: string; unit: string } | null;
  miscName: string | null;
  quantityPerUnit: string;
  unit: string;
  rate: string;
  amount: string;
  type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'MISC';
}

export interface RateAnalysis {
  id: string;
  name: string;
  unit: string;
  description: string | null;
  totalRate: string;
  stale: boolean;
  components: RateAnalysisComponent[];
  updatedAt: string;
}

export interface EstimateItem {
  id: string;
  sectionId: string;
  itemCode: string | null;
  description: string;
  unit: string;
  quantity: string;
  resourceId: string | null;
  rate: string;
  amount: string;
  type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'MISC';
}

export interface EstimateSection {
  id: string;
  name: string;
  orderIndex: number;
  items: EstimateItem[];
}

export interface EstimateSummary {
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  miscCost: number;
  subtotal: number;
  overheadPct: number;
  overheadAmount: number;
  contingencyPct: number;
  contingencyAmount: number;
  profitMarginPct: number;
  profitMarginAmount: number;
  grandTotalBeforeGST: number;
  gstAmount: number;
  grandTotal: number;
  materialPct: number;
  labourPct: number;
  equipmentPct: number;
  subPct: number;
  miscPct: number;
}

export interface Estimate {
  id: string;
  projectId: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
  notes: string | null;
  rejectionReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedByUser?: { name: string } | null;
  createdByUser: { name: string };
  createdAt: string;
  updatedAt: string;
  sections: EstimateSection[];
  items: EstimateItem[];
  summary: EstimateSummary;
}

export interface EstimateListRow {
  id: string;
  name: string;
  version: number;
  status: Estimate['status'];
  grandTotal: string;
  createdAt: string;
}

/** Alias used by list screens. */
export type EstimateListItem = EstimateListRow;

export interface EstimateComparison {
  estimateA: { name: string; version: number; grandTotal: number };
  estimateB: { name: string; version: number; grandTotal: number };
  sectionDiff: Array<{ name: string; amountA: number; amountB: number; diff: number; pctChange: number }>;
  grandTotalDiff: number;
  grandTotalPctChange: number;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export function useResources() {
  return useQuery({
    queryKey: ['resources'] as const,
    queryFn: () => apiFetch<{ data: Resource[] }>('/resources?limit=500'),
    staleTime: 60 * 60 * 1000,
  });
}

export function usePriceHistory(resourceId: string) {
  return useQuery({
    queryKey: ['resources', resourceId, 'price-history'] as const,
    queryFn: () => apiFetch<{ data: PriceHistoryPoint[] }>(`/resources/${resourceId}/price-history`),
    enabled: !!resourceId,
  });
}

// ---------------------------------------------------------------------------
// Rate Analysis
// ---------------------------------------------------------------------------

export function useAddPriceHistory(resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rate: number; effectiveDate?: string; notes?: string }) =>
      apiFetch<{ success: boolean }>(`/resources/${resourceId}/price-history`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources', resourceId, 'price-history'] });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export function useRateAnalyses() {
  return useQuery({
    queryKey: ['rate-analysis'] as const,
    queryFn: () => apiFetch<{ data: RateAnalysis[] }>('/rate-analysis?limit=500'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useRateAnalysis(id: string) {
  return useQuery({
    queryKey: ['rate-analysis', id] as const,
    queryFn: () => apiFetch<RateAnalysis>(`/rate-analysis/${id}`),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

export function useProjectEstimates(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'estimates'] as const,
    queryFn: () => apiFetch<{ data: EstimateListRow[] }>(`/projects/${projectId}/estimates`),
    enabled: !!projectId,
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: ['estimates', id] as const,
    queryFn: () => apiFetch<Estimate>(`/estimates/${id}`),
    enabled: !!id,
  });
}

export function useCreateEstimate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; notes?: string; overheadPct?: number; contingencyPct?: number; profitMarginPct?: number }) =>
      apiFetch<Estimate>(`/projects/${projectId}/estimates`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'estimates'] }),
  });
}

export function useEstimateMutations(estimateId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['estimates', estimateId] });

  return {
    updateMeta: useMutation({
      mutationFn: (body: Partial<{ name: string; notes: string; overheadPct: number; contingencyPct: number; profitMarginPct: number }>) =>
        apiFetch<Estimate>(`/estimates/${estimateId}`, { method: 'PUT', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    addSection: useMutation({
      mutationFn: (body: { name: string }) =>
        apiFetch<{ id: string }>(`/estimates/${estimateId}/sections`, { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    updateSection: useMutation({
      mutationFn: (args: { sectionId: string; name: string }) =>
        apiFetch<{ id: string }>(`/estimates/${estimateId}/sections/${args.sectionId}`, { method: 'PUT', body: JSON.stringify({ name: args.name }) }),
      onSuccess: invalidate,
    }),
    deleteSection: useMutation({
      mutationFn: (sectionId: string) => apiFetch<{ success: boolean }>(`/estimates/${estimateId}/sections/${sectionId}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
    addItem: useMutation({
      mutationFn: (body: {
        sectionId: string;
        description: string;
        unit: string;
        quantity: number;
        rate: number;
        type: EstimateItem['type'];
        resourceId?: string;
        itemCode?: string;
      }) => apiFetch<{ id: string }>(`/estimates/${estimateId}/sections/${body.sectionId}/items`, { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    updateItem: useMutation({
      mutationFn: (args: { itemId: string; body: Partial<{ description: string; unit: string; quantity: number; rate: number; type: EstimateItem['type'] }> }) =>
        apiFetch<{ id: string }>(`/estimate-items/${args.itemId}`, { method: 'PUT', body: JSON.stringify(args.body) }),
      onSuccess: invalidate,
    }),
    deleteItem: useMutation({
      mutationFn: (itemId: string) => apiFetch<{ success: boolean }>(`/estimate-items/${itemId}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
    submit: useMutation({ mutationFn: () => apiFetch<Estimate>(`/estimates/${estimateId}/submit`, { method: 'POST' }), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: () => apiFetch<Estimate>(`/estimates/${estimateId}/approve`, { method: 'POST' }), onSuccess: invalidate }),
    reject: useMutation({
      mutationFn: (reason: string) => apiFetch<Estimate>(`/estimates/${estimateId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
      onSuccess: invalidate,
    }),
    duplicate: useMutation({
      mutationFn: () => apiFetch<Estimate>(`/estimates/${estimateId}/duplicate`, { method: 'POST' }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['estimates'] }),
    }),
    convertToBoq: useMutation({
      mutationFn: () => apiFetch<{ message: string; boqItems: { id: string }[] }>(`/estimates/${estimateId}/convert-to-boq`, { method: 'POST' }),
      onSuccess: () => {
        invalidate();
        qc.invalidateQueries({ queryKey: ['estimates'] });
      },
    }),
  };
}

export function useCreateRateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      unit: string;
      description?: string;
      components: Array<{
        resourceId?: string;
        miscName?: string;
        quantityPerUnit: number;
        unit: string;
        rate: number;
        type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'MISC';
      }>;
    }) => apiFetch<RateAnalysis>('/rate-analysis', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-analysis'] }),
  });
}

export function useUpdateRateAnalysis(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<{
      name: string;
      unit: string;
      description: string;
      components: Array<{
        resourceId?: string;
        miscName?: string;
        quantityPerUnit: number;
        unit: string;
        rate: number;
        type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'MISC';
      }>;
    }>) => apiFetch<RateAnalysis>(`/rate-analysis/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-analysis'] });
      qc.invalidateQueries({ queryKey: ['rate-analysis', id] });
    },
  });
}

export function useDuplicateRateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<RateAnalysis>(`/rate-analysis/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-analysis'] }),
  });
}

export function useCompareEstimates(idA: string, idB: string) {
  return useQuery({
    queryKey: ['estimates', 'compare', idA, idB] as const,
    queryFn: () =>
      apiFetch<{
        estimateA: { name: string; version: number; grandTotal: number };
        estimateB: { name: string; version: number; grandTotal: number };
        sectionDiff: Array<{ name: string; amountA: number; amountB: number; diff: number; pctChange: number }>;
        grandTotalDiff: number;
        grandTotalPctChange: number;
      }>(`/estimates/${idA}/compare/${idB}`),
    enabled: !!idA && !!idB,
  });
}

// ---------------------------------------------------------------------------
// Exports (Excel + PDF)
// ---------------------------------------------------------------------------

export function useExportEstimate(estimateId: string) {
  return useMutation({
    mutationFn: async (format: 'excel' | 'pdf') => {
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const mime =
        format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf';
      const path = `/estimates/${estimateId}/export/${format}`;
      const filename = `estimate-${estimateId}.${ext}`;

      // On web, fetch the blob and trigger a browser download (since window.open
      // cannot set Authorization headers for JWT-protected endpoints).
      if (Platform.OS === 'web') {
        const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
        const res = await fetch(`${API_BASE_URL}${path}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = filename;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
      }

      const fileUri = await apiDownload(path, filename, mime);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: mime,
          dialogTitle: `Estimate ${format.toUpperCase()}`,
        });
      } else {
        Alert.alert('Exported', `File saved to ${fileUri}`);
      }
    },
  });
}
