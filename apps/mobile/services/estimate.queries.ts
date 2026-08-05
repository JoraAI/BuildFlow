/**
 * BuildFlow - React Query hooks for Resources, Rate Analysis & Estimates.
 */
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch, apiDownload, apiFetchList, type ApiListMeta } from '@/lib/api-client';
import { invalidateConvertToBoqImpact } from '@/lib/project-query-invalidation';
import type { CreateResourceInput, UpdateResourceInput } from '@buildflow/shared';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

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
  imageUrl: string | null;
  lastRateUpdatedAt: string | null;
  isActive: boolean;
}

export interface PriceHistoryPoint {
  id: string;
  rate: string;
  effectiveDate: string;
  notes: string | null;
  recordedBy: string;
  isScheduled?: boolean;
}

export interface RateAnalysisComponent {
  id: string;
  resourceId: string | null;
  resourceName?: string | null;
  resource?: { name: string; unit: string } | null;
  miscName: string | null;
  quantityPerUnit: number | string;
  unit: string;
  rate: number | string;
  amount: number | string;
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
  rateAnalysisId?: string | null;
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
  parentId?: string | null;
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
  parentId?: string | null;
  grandTotal: string;
  createdAt: string;
}

/** Alias used by list screens. */
export type EstimateListItem = EstimateListRow;

export interface ConvertToBoqResult {
  projectId: string;
  estimateId: string;
  created: number;
  archived: number;
  budget: number;
}

export interface EstimateComparison {
  estimateA: { name: string; version: number; grandTotal: number };
  estimateB: { name: string; version: number; grandTotal: number };
  sectionDiff: Array<{ name: string; amountA: number; amountB: number; diff: number; pctChange: number }>;
  grandTotalDiff: number;
  grandTotalPctChange: number;
}

/** Backend compare payload (snake_case-ish field names). */
interface CompareEstimatesApiResponse {
  estimateA: { id: string; name: string; version: number; grandTotal: number };
  estimateB: { id: string; name: string; version: number; grandTotal: number };
  sections: Array<{
    section: string;
    versionA: number;
    versionB: number;
    diff: number;
    changePct: number;
  }>;
  grandDiff: number;
  grandChangePct: number;
  summary?: string;
}

function mapCompareResponse(raw: CompareEstimatesApiResponse): EstimateComparison {
  return {
    estimateA: {
      name: raw.estimateA.name,
      version: raw.estimateA.version,
      grandTotal: raw.estimateA.grandTotal,
    },
    estimateB: {
      name: raw.estimateB.name,
      version: raw.estimateB.version,
      grandTotal: raw.estimateB.grandTotal,
    },
    sectionDiff: (raw.sections ?? []).map((s) => ({
      name: s.section,
      amountA: s.versionA,
      amountB: s.versionB,
      diff: s.diff,
      pctChange: s.changePct,
    })),
    grandTotalDiff: raw.grandDiff,
    grandTotalPctChange: raw.grandChangePct,
  };
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export interface MaterialsListResult {
  data: Resource[];
  meta: ApiListMeta;
}

export const materialKeys = {
  all: ['materials'] as const,
  list: (params: { search?: string; page?: number; limit?: number }) =>
    ['materials', params] as const,
};

function buildMaterialsPath(params: { search?: string; page?: number; limit?: number }) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 200;
  const qs = new URLSearchParams({
    type: 'MATERIAL',
    page: String(page),
    limit: String(limit),
  });
  const search = params.search?.trim();
  if (search) qs.set('search', search);
  return `/resources?${qs}`;
}

function patchMaterialsCaches(qc: QueryClient, patch: (prev: MaterialsListResult) => MaterialsListResult) {
  qc.setQueriesData<MaterialsListResult>({ queryKey: materialKeys.all }, (prev: MaterialsListResult | undefined) =>
    prev ? patch(prev) : prev,
  );
}

export function useMaterials(opts?: {
  search?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}) {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 200;
  const search = opts?.search?.trim() ?? '';

  return useQuery({
    queryKey: materialKeys.list({ search, page, limit }),
    queryFn: async () => {
      const { data, meta } = await apiFetchList<Resource>(
        buildMaterialsPath({ search, page, limit }),
      );
      return { data, meta };
    },
    staleTime: 5 * 60 * 1000,
    enabled: opts?.enabled !== false,
  });
}

export function useResources() {
  return useQuery({
    queryKey: ['resources'] as const,
    queryFn: async () => {
      const { data } = await apiFetchList<Resource>('/resources?limit=200');
      return { data };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadMaterialImage() {
  return useMutation({
    mutationFn: async (input: { uri: string; filename: string; contentType: string }) => {
      const { uploadUrl, imageUrl } = await apiFetch<{ uploadUrl: string; imageUrl: string }>(
        '/resources/image/upload-url',
        {
          method: 'POST',
          body: JSON.stringify({ filename: input.filename, contentType: input.contentType }),
        },
      );
      const blob = await fetch(input.uri).then((r) => r.blob());
      await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': input.contentType },
      });
      return imageUrl;
    },
  });
}

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateResourceInput) =>
      apiFetch<Resource>('/resources', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (created) => {
      if (created.type === 'MATERIAL') {
        patchMaterialsCaches(qc, (prev) => ({
          data: [created, ...prev.data.filter((r) => r.id !== created.id)],
          meta: { ...prev.meta, total: prev.meta.total + 1 },
        }));
      }
      qc.invalidateQueries({ queryKey: materialKeys.all });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export function useUpdateResource(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateResourceInput) =>
      apiFetch<Resource>(`/resources/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (updated) => {
      patchMaterialsCaches(qc, (prev) => ({
        ...prev,
        data: prev.data.map((r) => (r.id === updated.id ? updated : r)),
      }));
      qc.invalidateQueries({ queryKey: materialKeys.all });
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['resources', id, 'price-history'] });
    },
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/resources/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      patchMaterialsCaches(qc, (prev) => ({
        data: prev.data.filter((r) => r.id !== id),
        meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
      }));
      qc.invalidateQueries({ queryKey: materialKeys.all });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

// ─── Bulk operations ───────────────────────────────────────────────

export interface BulkUpsertResult {
  created: number;
  updated: number;
  unchanged: number;
  createdIds: string[];
  updatedIds: string[];
}

export function useBulkUpsertResources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resources: Array<{
      name: string;
      type: 'LABOUR' | 'MATERIAL' | 'EQUIPMENT' | 'SUBCONTRACTOR';
      unit: string;
      rate: number;
      gstRate?: number;
      hsnSacCode?: string;
      brandOrSpec?: string;
      category?: string;
    }>) =>
      apiFetch<BulkUpsertResult>('/resources/bulk-upsert', {
        method: 'POST',
        body: JSON.stringify({ resources }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: materialKeys.all });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export interface BulkPriceChange {
  resourceId: string;
  name: string;
  oldRate: number;
  newRate: number;
}

export interface BulkPriceUpdateResult {
  applied: number;
  scheduled: number;
  notFound: string[];
  changes: BulkPriceChange[];
}

export function useBulkPriceUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mode: 'absolute' | 'percent';
      effectiveDate: string;
      notes?: string;
      items: Array<{ resourceId: string; value: number }>;
    }) =>
      apiFetch<BulkPriceUpdateResult>('/resources/bulk-price', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: materialKeys.all });
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['rate-analysis'] });
    },
  });
}

export function usePriceHistory(resourceId: string) {
  return useQuery({
    queryKey: ['resources', resourceId, 'price-history'] as const,
    queryFn: () => apiFetch<PriceHistoryPoint[]>(`/resources/${resourceId}/price-history`),
    enabled: !!resourceId,
  });
}

// ---------------------------------------------------------------------------
// Rate Analysis
// ---------------------------------------------------------------------------

export function useAddPriceHistory(resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rate: number; effectiveDate: string; notes?: string }) =>
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
    queryFn: async () => {
      const { data } = await apiFetchList<RateAnalysis>('/rate-analysis?limit=200');
      // Sort alphabetically by name as a safety net
      return data.sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 30 * 1000,
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
    queryFn: () => apiFetch<EstimateListRow[]>(`/projects/${projectId}/estimates`),
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

// ---------------------------------------------------------------------------
// Sub-items (children of a parent estimate item)
// ---------------------------------------------------------------------------

export interface SubEstimateItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  type: string;
  resourceId: string | null;
  notes: string | null;
  parentId: string | null;
}

export function useSubItems(parentItemId: string) {
  return useQuery({
    queryKey: ['estimate-items', parentItemId, 'sub-items'] as const,
    queryFn: () => apiFetch<SubEstimateItem[]>(`/estimate-items/${parentItemId}/sub-items`),
    enabled: !!parentItemId,
  });
}

export function useCreateSubItem(parentItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      description: string;
      unit: string;
      quantity: number;
      rate: number;
      type: EstimateItem['type'];
      resourceId?: string;
      notes?: string;
    }) =>
      apiFetch<{ id: string }>(`/estimate-items/${parentItemId}/sub-items`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimate-items', parentItemId, 'sub-items'] });
    },
  });
}

export function useDeleteSubItem(parentItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subItemId: string) =>
      apiFetch<{ success: boolean }>(`/estimate-items/${parentItemId}/sub-items/${subItemId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimate-items', parentItemId, 'sub-items'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Sub-estimates (child estimates for additional scope)
// ---------------------------------------------------------------------------

export interface SubEstimateRow {
  id: string;
  name: string;
  version: number;
  status: string;
  grandTotal: number;
  createdAt: string;
  approvedAt: string | null;
}

/**
 * EST-VO-11c: Variation summary returned by GET /estimates/:id/variations.
 */
export interface EstimateVariationRow {
  id: string;
  number: string;
  title: string;
  status: string;
  costImpact: string;
  scheduleImpactDays: number;
  approvedAt: string | null;
  createdAt: string;
  boqAppliedAt?: string | null;
  lines: Array<{ id: string }>;
}

/**
 * EST-VO-11c: Variations linked to an estimate (change orders).
 */
export function useEstimateVariations(estimateId: string) {
  return useQuery({
    queryKey: ['estimates', estimateId, 'variations'] as const,
    queryFn: () =>
      apiFetch<EstimateVariationRow[]>(`/estimates/${estimateId}/variations`),
    enabled: !!estimateId,
  });
}

export function useSubEstimates(parentEstimateId: string) {
  return useQuery({
    queryKey: ['estimates', parentEstimateId, 'sub-estimates'] as const,
    queryFn: () => apiFetch<SubEstimateRow[]>(`/estimates/${parentEstimateId}/sub-estimates`),
    enabled: !!parentEstimateId,
  });
}

export function useCreateSubEstimate(parentEstimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; notes?: string }) =>
      apiFetch<{ id: string }>(`/estimates/${parentEstimateId}/sub-estimates`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates', parentEstimateId, 'sub-estimates'] });
    },
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
        apiFetch<{ id: string; name: string }>(`/estimates/${estimateId}/sections`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
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
        rateAnalysisId?: string;
        itemCode?: string;
      }) => apiFetch<{ id: string }>(`/estimates/${estimateId}/sections/${body.sectionId}/items`, { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    updateItem: useMutation({
      mutationFn: (args: {
        itemId: string;
        body: Partial<{
          description: string;
          unit: string;
          quantity: number;
          rate: number;
          type: EstimateItem['type'];
          resourceId: string | null;
          rateAnalysisId: string | null;
        }>;
      }) =>
        apiFetch<{ id: string }>(`/estimate-items/${args.itemId}`, { method: 'PUT', body: JSON.stringify(args.body) }),
      onSuccess: invalidate,
    }),
    deleteItem: useMutation({
      mutationFn: (itemId: string) => apiFetch<{ success: boolean }>(`/estimate-items/${itemId}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
    submit: useMutation({
      mutationFn: () => apiFetch<Estimate>(`/estimates/${estimateId}/submit`, { method: 'POST' }),
      onSuccess: (data) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ['proposals'] });
        qc.invalidateQueries({ queryKey: ['projects', data.projectId, 'estimates'] });
      },
    }),
    approve: useMutation({
      mutationFn: () => apiFetch<Estimate>(`/estimates/${estimateId}/approve`, { method: 'POST' }),
      onSuccess: (data) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ['proposals'] });
        qc.invalidateQueries({ queryKey: ['projects', data.projectId, 'estimates'] });
        // Invalidate ALL sub-estimate caches — approving a new version
        // supersedes old parent estimates AND cascades to their sub-estimates.
        // Without this, stale "APPROVED" status shows for superseded sub-estimates.
        qc.invalidateQueries({ queryKey: ['estimates'] });
      },
    }),
    reject: useMutation({
      mutationFn: (reason: string) => apiFetch<Estimate>(`/estimates/${estimateId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
      onSuccess: invalidate,
    }),
    duplicate: useMutation({
      mutationFn: () => apiFetch<Estimate>(`/estimates/${estimateId}/duplicate`, { method: 'POST' }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['estimates'] }),
    }),
    convertToBoq: useMutation({
      mutationFn: () =>
        apiFetch<ConvertToBoqResult>(`/estimates/${estimateId}/convert-to-boq`, { method: 'POST' }),
      onSuccess: (data) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ['estimates'] });
        invalidateConvertToBoqImpact(qc, data.projectId);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-analysis'], refetchType: 'active' }),
  });
}

export function useDeleteRateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; force?: boolean }) =>
      apiFetch<{ id: string }>(`/rate-analysis/${input.id}${input.force ? '?force=true' : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-analysis'], refetchType: 'active' }),
  });
}

export function useCompareEstimates(idA: string, idB: string) {
  return useQuery({
    queryKey: ['estimates', 'compare', idA, idB] as const,
    queryFn: async () => {
      const raw = await apiFetch<CompareEstimatesApiResponse>(`/estimates/${idA}/compare/${idB}`);
      return mapCompareResponse(raw);
    },
    enabled: !!idA && !!idB && idA !== idB,
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

      const fileUri = await apiDownload(path, filename, mime);
      if (fileUri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(fileUri, {
          mimeType: mime,
          dialogTitle: `Estimate ${format.toUpperCase()}`,
        });
      } else if (fileUri) {
        Alert.alert('Exported', `File saved to ${fileUri}`);
      }
    },
  });
}
