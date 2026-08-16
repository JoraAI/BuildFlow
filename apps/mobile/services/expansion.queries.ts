/**
 * BuildFlow - React Query hooks for platform expansion features:
 * change orders, procurement, subcontract, portal, report schedules.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { API_BASE_URL } from '@/constants';
import {
  invalidateChangeOrderImpact,
  invalidateEstimateVariations,
  invalidateProjectAccounting,
  invalidateProjectBoq,
  invalidateProjectCore,
  invalidateProjectSubcontract,
  invalidateProcurementLists,
  invalidateProcurementStock,
  invalidateAnalyticsDashboard,
} from '@/lib/project-query-invalidation';
import type {
  CreateChangeOrderInput,
  CreateRequisitionInput,
  CreatePurchaseOrderInput,
  CreateGrnInput,
  CreateSubcontractorInput,
  CreateWorkOrderInput,
  CreateWorkOrderFromBoqInput,
  CreateMeasurementInput,
  CreatePortalAccessInput,
  CreateSubcontractorPortalInput,
  CreateReportScheduleInput,
} from '@buildflow/shared';
import type { Role } from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */

export const expansionKeys = {
  changeOrders: (projectId: string) => ['change-orders', projectId] as const,
  requisitions: (projectId: string) => ['procurement', 'requisitions', projectId] as const,
  nextNumbers: (projectId: string) => ['procurement', 'next-numbers', projectId] as const,
  stock: (projectId: string) => ['procurement', 'stock', projectId] as const,
  stockSummary: (projectId: string) => ['procurement', 'stock', 'summary', projectId] as const,
  stockMovements: (projectId: string, resourceId: string) =>
    ['procurement', 'stock', 'movements', projectId, resourceId] as const,
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch / expiry surfaces.
  resourceBatches: (resourceId: string) => ['inventory', 'stock', 'batches', resourceId] as const,
  expirySummary: ['inventory', 'stock', 'expiry-summary'] as const,
  boqShortfalls: (projectId: string) => ['procurement', 'boq-shortfalls', projectId] as const,
  subcontractors: ['subcontractors'] as const,
  workOrders: (projectId: string) => ['subcontract', 'work-orders', projectId] as const,
  workOrderSummary: (projectId: string, workOrderId: string) =>
    ['subcontract', 'summary', projectId, workOrderId] as const,
  measurements: (projectId: string, workOrderId: string) =>
    ['subcontract', 'measurements', projectId, workOrderId] as const,
  reportSchedules: ['report-schedules'] as const,
  portal: (token: string) => ['portal', token] as const,
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface ChangeOrderLine {
  id: string;
  description: string;
  unit: string;
  qtyDelta: string;
  rate: string;
  amount: string;
  boqItemId?: string | null;
  resourceId?: string | null;
}

export interface ChangeOrder {
  id: string;
  number: string;
  title: string;
  reason: string | null;
  status: ApprovalStatus;
  costImpact: string;
  scheduleImpactDays: number;
  linkedTaskId?: string | null;
  linkedWorkOrderId?: string | null;
  estimateId?: string | null;
  boqAppliedAt?: string | null;
  createdAt: string;
  lines: ChangeOrderLine[];
  createdByUser?: { id: string; name: string };
  linkedTask?: { id: string; name: string };
  linkedWorkOrder?: { id: string; woNumber: string };
}

export interface RequisitionLine {
  id: string;
  resourceId: string;
  quantity: string;
  unit: string;
  boqItemId?: string | null;
  expectedRate?: string | null;
  rateSource?: string | null;
  resource?: { id: string; name: string };
  boqItem?: { itemCode: string; description: string } | null;
}

export interface BoqShortfall {
  boqItemId: string;
  itemCode: string;
  description: string;
  resourceId: string;
  resourceName: string;
  quantity: number;
  unit: string;
  stockQty: number;
  openRequisitionQty: number;
  shortfall: number;
}

export interface GenerateFromBoqResult {
  created: number;
  reqNumbers: string[];
}

export interface PurchaseOrderLine {
  id: string;
  resourceId: string;
  quantity: string;
  unit: string;
  rate: string;
  resource: { id: string; name: string; unit: string };
}

export interface GoodsReceiptSummary {
  id: string;
  grnNumber: string;
  receivedDate: string;
  lines: Array<{ resourceId: string; quantity: string; unit: string }>;
}

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  status: string;
  vendorName?: string;
  vendorGstin?: string;
  totalAmount?: string;
  bills?: Array<{
    id: string;
    billNumber: string;
    status: string;
    total: string;
    attachmentUrl: string | null;
  }>;
  lines: PurchaseOrderLine[];
  goodsReceipts?: GoodsReceiptSummary[];
}

export interface Requisition {
  id: string;
  reqNumber: string;
  status: ApprovalStatus;
  notes: string | null;
  sourceType?: string | null;
  sourceRef?: string | null;
  createdAt: string;
  lines: RequisitionLine[];
  purchaseOrders?: PurchaseOrderSummary[];
}

export interface StockBalance {
  id: string;
  quantity: string;
  resource: { id: string; name: string; unit: string };
}

export interface StockLocation {
  id: string;
  name: string;
  balances: StockBalance[];
}

export interface StockSummaryRow {
  resourceId: string;
  name: string;
  unit: string;
  catalogRate?: number;
  mrp?: number | null;
  /** Phase 1.5: low-stock threshold. */
  reorderPoint?: number;
  received: number;
  issued: number;
  balance: number;
  /** Phase 5.2: WAC unit cost + inventory value (balance × WAC). */
  unitCost?: number;
  inventoryValue?: number;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.3): POS cart GST + tracking.
  gstRate?: number;
  trackingMode?: string;
  nextExpiryAt?: string | null;
  activeBatchCount?: number;
}

export interface StockMovementRow {
  id: string;
  type: string;
  quantity: number;
  unit: string;
  createdAt: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  locationName: string;
  /** Phase 1.3: adjustment audit. */
  reason: string | null;
  notes: string | null;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): batch / lot code on history. */
  batchCode: string | null;
}

export interface Subcontractor {
  id: string;
  name: string;
  gstin: string | null;
  contactPhone: string | null;
  _count?: { workOrders: number };
}

export interface WorkOrder {
  id: string;
  woNumber: string;
  scope: string;
  contractValue: string;
  retentionPct: string;
  advanceAmount: string;
  status: string;
  subcontractor: { id: string; name: string; gstin?: string | null };
  contractLines?: WorkOrderLine[];
  _count?: { measurements: number };
}

export interface WorkOrderLine {
  id: string;
  description: string;
  unit: string;
  contractQty: string;
  rate: string;
  amount: string;
  boqItemId?: string | null;
}

export interface WorkOrderSummary {
  materialSupplyMode?: string;
  materialIssuedTotal?: number;
  materialRecoveredTotal?: number;
  netMaterialOnWO?: number;
  contractValue: number;
  retentionPct: number;
  advanceAmount: number;
  advanceRecovered: number;
  certifiedTotal: number;
  submittedPending: number;
  billedTotal: number;
  paidTotal: number;
  retentionHeld: number;
  retentionReleased: number;
  balanceRemaining: number;
  variationTotal: number;
  certifiedPct: number;
  lines: Array<{
    id: string;
    description: string;
    unit: string;
    contractQty: number;
    rate: number;
    amount: number;
    certifiedQty: number;
    balanceQty: number;
    boqItemId: string | null;
  }>;
  variations: Array<{ number: string; title: string; costImpact: number }>;
}

export interface MeasurementLine {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  amount: string;
}

export interface Measurement {
  id: string;
  periodLabel: string;
  status: ApprovalStatus;
  totalAmount: string;
  rejectionReason?: string | null;
  createdAt: string;
  lines: MeasurementLine[];
  bills?: { id: string; billNumber: string; status: string }[];
}

export interface SubcontractPortalAccessResult {
  id: string;
  label: string;
  scopes: string[];
  expiresAt: string;
  token: string;
}

export interface PortalAccessResult {
  id: string;
  label: string;
  scopes: string[];
  expiresAt: string;
  token: string;
}

export interface PortalData {
  project: {
    id: string;
    name: string;
    code: string;
    status: string;
    clientName: string;
  };
  scopes: string[];
  label: string;
  expiresAt: string;
  progress?: {
    tasks: Array<{ id: string; name: string; status: string; progressPct: number; endDate: string | null }>;
    recentReports: Array<{ id: string; reportDate: string; workDone: string | null; weather: string | null }>;
  };
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    status: string;
    total: string;
    paidAmount: string;
  }>;
}

export interface ReportSchedule {
  id: string;
  reportType: 'GST_SUMMARY' | 'TDS_REPORT' | 'COMPANY_DASHBOARD' | 'PROJECT_PL';
  cronExpr: string;
  recipients: string[];
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* PDF path helpers                                                    */
/* ------------------------------------------------------------------ */
/* Change order impact / scope summary (VO-B1/B4)                      */
/* ------------------------------------------------------------------ */

export interface ChangeOrderImpact {
  boqChanges: Array<{
    boqItemId: string;
    itemCode: string;
    description: string;
    qtyBefore: number;
    qtyAfter: number;
    variationNumber: string;
  }>;
  indentsCreated: Array<{ id: string; reqNumber: string; status: string }>;
  budgetDelta: number;
  scheduleImpactDays: number;
}

export interface ProjectScopeSummary {
  originalEstimateTotal: number;
  approvedVariationTotal: number;
  revisedScopeTotal: number;
  currentBoqTotal: number;
}

export function useChangeOrderImpact(projectId: string, changeOrderId: string | null) {
  return useQuery({
    queryKey: ['change-order-impact', projectId, changeOrderId] as const,
    queryFn: () => apiFetch<ChangeOrderImpact>(
      `/projects/${projectId}/change-orders/${changeOrderId}/impact`,
    ),
    enabled: !!projectId && !!changeOrderId,
  });
}

export function useProjectScopeSummary(projectId: string) {
  return useQuery({
    queryKey: ['project-scope-summary', projectId] as const,
    queryFn: () => apiFetch<ProjectScopeSummary>(`/projects/${projectId}/scope-summary`),
    enabled: !!projectId,
  });
}

/* ------------------------------------------------------------------ */
/* Change orders                                                       */
/* ------------------------------------------------------------------ */

export function useChangeOrders(projectId: string) {
  return useQuery({
    queryKey: expansionKeys.changeOrders(projectId),
    queryFn: () => apiFetch<ChangeOrder[]>(`/projects/${projectId}/change-orders`),
    enabled: !!projectId,
  });
}

export function useCreateChangeOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChangeOrderInput) =>
      apiFetch<ChangeOrder>(`/projects/${projectId}/change-orders`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) });
      // EST-VO-11e: Refresh estimate variations list
      invalidateEstimateVariations(qc);
    },
  });
}

export function useSubmitChangeOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeOrderId: string) =>
      apiFetch<ChangeOrder>(`/projects/${projectId}/change-orders/${changeOrderId}/submit`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) });
      // EST-VO-11e: Refresh estimate variations list
      invalidateEstimateVariations(qc);
    },
  });
}

export function useApproveChangeOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeOrderId: string) =>
      apiFetch<ChangeOrder>(`/projects/${projectId}/change-orders/${changeOrderId}/approve`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => invalidateChangeOrderImpact(qc, projectId),
  });
}

/** VAR-D2: Convert an approved variation to BOQ (explicit step) */
export function useConvertChangeOrderToBoq(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeOrderId: string) =>
      apiFetch<ChangeOrder>(`/projects/${projectId}/change-orders/${changeOrderId}/convert-to-boq`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) });
      invalidateChangeOrderImpact(qc, projectId);
      invalidateProjectBoq(qc, projectId);
      invalidateEstimateVariations(qc);
    },
  });
}

export function useRejectChangeOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ changeOrderId, reason }: { changeOrderId: string; reason: string }) =>
      apiFetch<ChangeOrder>(`/projects/${projectId}/change-orders/${changeOrderId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) });
      // EST-VO-11e: Refresh estimate variations list
      invalidateEstimateVariations(qc);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Procurement                                                         */
/* ------------------------------------------------------------------ */

export function useRequisitions(projectId: string) {
  return useQuery({
    queryKey: expansionKeys.requisitions(projectId),
    queryFn: () => apiFetch<Requisition[]>(`/projects/${projectId}/procurement/requisitions`),
    enabled: !!projectId,
  });
}

export function useCreateRequisition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRequisitionInput) =>
      apiFetch<Requisition>(`/projects/${projectId}/procurement/requisitions`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) });
    },
  });
}

export function useDeleteRequisition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requisitionId: string) =>
      apiFetch<{ success: boolean }>(
        `/projects/${projectId}/procurement/requisitions/${requisitionId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) });
    },
  });
}

export function useSubmitRequisition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requisitionId: string) =>
      apiFetch<Requisition>(
        `/projects/${projectId}/procurement/requisitions/${requisitionId}/submit`,
        { method: 'POST', body: '{}' },
      ),
    onSuccess: (data) => {
      // Cache-patch the status so the badge updates instantly; refetch in
      // background (void so mutateAsync settles on HTTP success, not refetch).
      qc.setQueryData<Requisition[]>(expansionKeys.requisitions(projectId), (old: Requisition[] | undefined) =>
        old?.map((r) => (r.id === data.id ? { ...r, status: data.status } : r)),
      );
      void qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) });
    },
  });
}

export function useApproveRequisition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requisitionId: string) =>
      apiFetch<Requisition>(
        `/projects/${projectId}/procurement/requisitions/${requisitionId}/approve`,
        { method: 'POST', body: '{}' },
      ),
    onSuccess: (data) => {
      qc.setQueryData<Requisition[]>(expansionKeys.requisitions(projectId), (old: Requisition[] | undefined) =>
        old?.map((r) => (r.id === data.id ? { ...r, status: data.status } : r)),
      );
      void qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) });
    },
  });
}

export function useCreatePurchaseOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) =>
      apiFetch(`/projects/${projectId}/procurement/purchase-orders`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    // PROCUREMENT_PICKER_PERF: a new PO only changes the requisition list
    // (the indent gains a PO and leaves the New PO picker). No stock refetch.
    // Important: void the invalidate - returning its Promise made mutateAsync
    // wait for the full list refetch, leaving the New PO modal stuck open.
    onSuccess: () => {
      void invalidateProcurementLists(qc, projectId);
      void qc.invalidateQueries({ queryKey: expansionKeys.nextNumbers(projectId) });
    },
  });
}

/** INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): approve a SUBMITTED inventory PO. */
export function useApprovePurchaseOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (poId: string) =>
      apiFetch<PurchaseOrderSummary>(`/projects/${projectId}/procurement/purchase-orders/${poId}/approve`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void invalidateProcurementLists(qc, projectId);
    },
  });
}

export function useNextProcurementNumbers(projectId: string, enabled = true) {
  return useQuery({
    queryKey: expansionKeys.nextNumbers(projectId),
    queryFn: () =>
      apiFetch<{ po: string; grn: string }>(`/projects/${projectId}/procurement/next-numbers`),
    enabled: !!projectId && enabled,
    staleTime: 0,
  });
}

export function useCreateGRN(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGrnInput) =>
      apiFetch(`/projects/${projectId}/procurement/grn`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    // PROCUREMENT_PICKER_PERF: GRN changes the requisition list (PO receipt
    // status) + stock summary/locations - not BOQ/shortfalls.
    onSuccess: () => {
      void invalidateProcurementLists(qc, projectId);
      void invalidateProcurementStock(qc, projectId);
      // Inventory auto-draft bills appear on GRN - refresh AP lists.
      void qc.invalidateQueries({ queryKey: ['bills', 'list', projectId] });
      void qc.invalidateQueries({ queryKey: ['bills', 'summary', projectId] });
      void qc.invalidateQueries({ queryKey: expansionKeys.nextNumbers(projectId) });
    },
  });
}

export function useStock(projectId: string) {
  return useQuery({
    queryKey: expansionKeys.stock(projectId),
    queryFn: () => apiFetch<StockLocation[]>(`/projects/${projectId}/procurement/stock`),
    enabled: !!projectId,
  });
}

export function useStockSummary(projectId: string, locationId?: string) {
  return useQuery({
    queryKey: [...expansionKeys.stockSummary(projectId), locationId ?? 'all'],
    queryFn: () =>
      apiFetch<StockSummaryRow[]>(
        `/projects/${projectId}/procurement/stock/summary${locationId ? `?locationId=${locationId}` : ''}`,
      ),
    enabled: !!projectId,
  });
}

export function useStockMovements(projectId: string, resourceId: string | undefined, locationId?: string) {
  return useQuery({
    queryKey: [...expansionKeys.stockMovements(projectId, resourceId ?? ''), locationId ?? 'all'],
    queryFn: () =>
      apiFetch<StockMovementRow[]>(
        `/projects/${projectId}/procurement/stock/movements?resourceId=${resourceId}&locationId=${locationId ?? ''}&limit=50`,
      ),
    enabled: !!projectId && !!resourceId,
  });
}

export interface StockIssueLineResult {
  movementId: string;
  resourceId: string;
  resourceName: string;
  unit: string;
  quantityIssued: number;
  quantityOnHand: number;
  unitPrice: number | null;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.3): server FEFO lot allocations.
  allocations: Array<{ batchCode: string; quantity: number; expiresAt: string | null }> | null;
}

export interface StockIssueResult extends StockIssueLineResult {
  movementIds: string[];
  lines: StockIssueLineResult[];
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  draftInvoiceId: string | null;
}

export interface IssueStockInput {
  lines: Array<{ resourceId: string; quantity: number; unitPrice?: number }>;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): optional party-master link.
  customerId?: string;
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): issue from a specific warehouse.
  locationId?: string;
  notes?: string;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): authorized override to sell
  // EXPIRED lots (FEFO otherwise rejects expired-only stock).
  allowExpired?: boolean;
}

export function useIssueStock(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueStockInput) =>
      apiFetch<StockIssueResult>(`/projects/${projectId}/procurement/stock/issue`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expansionKeys.stockSummary(projectId) });
      void qc.invalidateQueries({ queryKey: expansionKeys.stock(projectId) });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'movements', projectId] });
      void qc.invalidateQueries({ queryKey: ['invoices', 'list', projectId] });
      void qc.invalidateQueries({ queryKey: ['transactions', 'sales-orders'] });
      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.3): a counter sale changes
      // lot balances, the executive dashboard, and expiry buckets.
      void qc.invalidateQueries({ queryKey: ['inventory', 'stock', 'batches'] });
      void qc.invalidateQueries({ queryKey: ['inventory', 'stock', 'expiry-summary'] });
      void qc.invalidateQueries({ queryKey: ['inventory', 'analytics', 'dashboard'] });
    },
  });
}

// INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch / expiry read surfaces
// (Kirana-vertical only; the backend `batch_expiry` gate returns 403 otherwise).

export interface ResourceBatchRow {
  id: string;
  locationId: string;
  locationName: string;
  batchCode: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  quantity: number;
  receivedAt: string;
  daysToExpiry: number | null;
  bucket: 'EXPIRED' | '0_30' | '31_60' | '61_90' | 'OVER_90' | null;
}

export function useResourceBatches(resourceId: string | undefined, locationId?: string) {
  return useQuery({
    queryKey: [...expansionKeys.resourceBatches(resourceId ?? ''), locationId ?? 'all'],
    queryFn: () =>
      apiFetch<ResourceBatchRow[]>(
        `/inventory/stock/batches?resourceId=${resourceId}${locationId ? `&locationId=${locationId}` : ''}`,
      ),
    enabled: !!resourceId,
  });
}

export function useUpdateBatchMetadata(resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; manufacturedAt?: string | null; expiresAt?: string | null }) =>
      apiFetch(`/inventory/stock/batches/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          manufacturedAt: input.manufacturedAt || null,
          expiresAt: input.expiresAt || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expansionKeys.resourceBatches(resourceId) });
      qc.invalidateQueries({ queryKey: expansionKeys.expirySummary });
    },
  });
}

export interface ExpiryBucketSummary {
  EXPIRED: number;
  '0_30': number;
  '31_60': number;
  '61_90': number;
  OVER_90: number;
  totalTrackedLots: number;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4): WAC values for the KPIs.
  EXPIRED_VALUE: number;
  '0_30_VALUE': number;
}

export function useExpirySummary() {
  return useQuery({
    queryKey: expansionKeys.expirySummary,
    queryFn: () => apiFetch<ExpiryBucketSummary>('/inventory/stock/expiry-summary'),
  });
}

export interface AdjustStockInput {
  resourceId: string;
  delta: number;
  reason:
    | 'DAMAGE'
    | 'LOSS'
    | 'THEFT'
    | 'EXPIRY'
    | 'STOCKTAKE'
    | 'OPENING_STOCK'
    | 'FOUND_STOCK'
    | 'CORRECTION'
    | 'OTHER';
  notes?: string;
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): adjust a specific warehouse.
  locationId?: string;
}

export interface AdjustStockResult {
  movementId: string;
  resourceId: string;
  resourceName: string;
  unit: string;
  delta: number;
  previousOnHand: number;
  quantityOnHand: number;
  reason: string;
  notes: string | null;
}

/** INVENTORY_HORIZONTAL_PLATFORM (Phase 1.3): stock adjustment. */
export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustStockInput) =>
      apiFetch<AdjustStockResult>('/inventory/stock/adjust', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary'] });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'movements'] });
    },
  });
}

export interface QuickVendorReceiptInput {
  vendorId?: string;
  vendorName?: string;
  invoiceNumber?: string;
  receivedDate: string;
  notes?: string;
  locationId?: string;
  lines: Array<{
    resourceId: string;
    quantity: number;
    unitCost: number;
    batchCode?: string;
    manufacturedAt?: string;
    expiresAt?: string;
  }>;
}

export function useQuickVendorReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: QuickVendorReceiptInput) =>
      apiFetch('/inventory/stock/quick-receipt', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement', 'stock'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'analytics'] });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export interface OpeningStockLine {
  resourceId?: string;
  sku?: string;
  itemCode?: string;
  name?: string;
  quantity: number;
  rate?: number;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): optional lot metadata.
  batchCode?: string;
  manufacturedAt?: string | Date;
  expiresAt?: string | Date;
}

export interface OpeningStockResult {
  applied: number;
  missed: number;
  lines: Array<{ resourceId: string; resourceName: string; unit: string; delta: number; quantityOnHand: number }>;
  unmatched: Array<{ key: string; reason: string }>;
}

/** INVENTORY_HORIZONTAL_PLATFORM (Phase 1.4): opening stock import. */
export function useImportOpeningStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { lines: OpeningStockLine[]; locationId?: string }) =>
      apiFetch<OpeningStockResult>('/inventory/stock/opening-stock', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary'] });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'movements'] });
      void qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export function useBoqShortfalls(projectId: string, enabled = true) {
  return useQuery({
    queryKey: expansionKeys.boqShortfalls(projectId),
    queryFn: () => apiFetch<BoqShortfall[]>(`/projects/${projectId}/procurement/boq-shortfalls`),
    enabled: !!projectId && enabled,
  });
}

export function useGenerateIndentsFromBoq(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<GenerateFromBoqResult>(`/projects/${projectId}/procurement/generate-from-boq`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) });
      qc.invalidateQueries({ queryKey: expansionKeys.boqShortfalls(projectId) });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Subcontract                                                         */
/* ------------------------------------------------------------------ */

export function useSubcontractors() {
  return useQuery({
    queryKey: expansionKeys.subcontractors,
    queryFn: () => apiFetch<Subcontractor[]>('/subcontractors'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubcontractorInput) =>
      apiFetch<Subcontractor>('/subcontractors', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.subcontractors }),
  });
}

export function useWorkOrders(projectId: string) {
  return useQuery({
    queryKey: expansionKeys.workOrders(projectId),
    queryFn: () => apiFetch<WorkOrder[]>(`/projects/${projectId}/subcontract/work-orders`),
    enabled: !!projectId,
  });
}

export function useCreateWorkOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkOrderInput) =>
      apiFetch<WorkOrder>(`/projects/${projectId}/subcontract/work-orders`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateProjectSubcontract(qc, projectId),
  });
}

export function useCreateWorkOrderFromBoq(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkOrderFromBoqInput) =>
      apiFetch<WorkOrder>(`/projects/${projectId}/subcontract/work-orders/from-boq`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidateProjectSubcontract(qc, projectId);
      invalidateProjectBoq(qc, projectId);
    },
  });
}

export interface UpdateWorkOrderResult {
  workOrder: WorkOrder;
  retentionReleaseBill?: {
    id: string;
    billNumber: string;
    total: number;
  } | null;
}

export function useUpdateWorkOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workOrderId, ...input }: Partial<CreateWorkOrderInput> & { workOrderId: string; status?: string }) =>
      apiFetch<UpdateWorkOrderResult>(`/projects/${projectId}/subcontract/work-orders/${workOrderId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateProjectSubcontract(qc, projectId),
  });
}

export function useWorkOrderSummary(projectId: string, workOrderId: string, enabled = true) {
  return useQuery({
    queryKey: expansionKeys.workOrderSummary(projectId, workOrderId),
    queryFn: () =>
      apiFetch<WorkOrderSummary>(
        `/projects/${projectId}/subcontract/work-orders/${workOrderId}/summary`,
      ),
    enabled: !!projectId && !!workOrderId && enabled,
  });
}

export function useMeasurements(projectId: string, workOrderId: string) {
  return useQuery({
    queryKey: expansionKeys.measurements(projectId, workOrderId),
    queryFn: () =>
      apiFetch<Measurement[]>(
        `/projects/${projectId}/subcontract/work-orders/${workOrderId}/measurements`,
      ),
    enabled: !!projectId && !!workOrderId,
  });
}

export function useCreateMeasurement(projectId: string, workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMeasurementInput) =>
      apiFetch<Measurement>(
        `/projects/${projectId}/subcontract/work-orders/${workOrderId}/measurements`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: expansionKeys.measurements(projectId, workOrderId) }),
  });
}

export function useSubmitMeasurement(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (measurementId: string) =>
      apiFetch<Measurement>(
        `/projects/${projectId}/subcontract/measurements/${measurementId}/submit`,
        { method: 'POST', body: '{}' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontract', 'measurements'] }),
  });
}

export function useApproveMeasurement(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (measurementId: string) =>
      apiFetch<{ measurement: Measurement; bill?: { id: string; billNumber: string; total: string } }>(
        `/projects/${projectId}/subcontract/measurements/${measurementId}/approve`,
        { method: 'POST', body: JSON.stringify({ createBill: true }) },
      ),
    onSuccess: () => {
      invalidateProjectSubcontract(qc, projectId);
      invalidateProjectAccounting(qc, projectId);
      invalidateProjectBoq(qc, projectId);
      invalidateProjectCore(qc, projectId);
      invalidateAnalyticsDashboard(qc);
    },
  });
}

export function useRejectMeasurement(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ measurementId, reason }: { measurementId: string; reason?: string }) =>
      apiFetch<Measurement>(
        `/projects/${projectId}/subcontract/measurements/${measurementId}/reject`,
        { method: 'POST', body: JSON.stringify({ reason }) },
      ),
    onSuccess: () => invalidateProjectSubcontract(qc, projectId),
  });
}

export function useRecordSubcontractBillPayment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ billId, amount }: { billId: string; amount: number }) =>
      apiFetch(`/projects/${projectId}/subcontract/bills/${billId}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    onSuccess: () => {
      invalidateProjectSubcontract(qc, projectId);
      invalidateProjectAccounting(qc, projectId);
    },
  });
}

// SUB-C2a: Material issue hooks for subcontract WO detail
export interface SubcontractorMaterialIssue {
  id: string;
  resourceId: string;
  quantity: string;
  unit: string;
  rate: string;
  amount: string;
  issueDate: string;
  notes: string | null;
  recoveredQty: string;
  recoveredAmount: string;
  resource?: { id: string; name: string; unit: string };
  issuedByUser?: { id: string; name: string };
}

export function useMaterialIssues(projectId: string, workOrderId: string | null) {
  return useQuery({
    queryKey: ['subcontract', 'material-issues', projectId, workOrderId],
    queryFn: () => apiFetch<SubcontractorMaterialIssue[]>(
      `/projects/${projectId}/subcontract/work-orders/${workOrderId}/material-issues`,
    ),
    enabled: !!projectId && !!workOrderId,
  });
}

export function useIssueMaterial(projectId: string, workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { resourceId: string; quantity: number; unit: string; rate: number; issueDate: string; notes?: string; boqItemId?: string }) =>
      apiFetch<SubcontractorMaterialIssue>(
        `/projects/${projectId}/subcontract/work-orders/${workOrderId}/material-issues`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcontract', 'material-issues', projectId, workOrderId] });
      qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary', projectId] });
      invalidateProjectBoq(qc, projectId);
      invalidateProjectSubcontract(qc, projectId);
    },
  });
}

export function useRecoverMaterial(projectId: string, workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, recoveredQty }: { issueId: string; recoveredQty: number }) =>
      apiFetch<SubcontractorMaterialIssue>(
        `/projects/${projectId}/subcontract/work-orders/${workOrderId}/material-issues/${issueId}/recover`,
        { method: 'POST', body: JSON.stringify({ recoveredQty }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcontract', 'material-issues', projectId, workOrderId] });
      qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary', projectId] });
      invalidateProjectBoq(qc, projectId);
    },
  });
}

export function useCreateSubcontractorPortalAccess(projectId: string) {
  return useMutation({
    mutationFn: (input: CreateSubcontractorPortalInput) =>
      apiFetch<SubcontractPortalAccessResult>(`/projects/${projectId}/subcontract-portal-access`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/* ------------------------------------------------------------------ */
/* Portal                                                              */
/* ------------------------------------------------------------------ */

export function useCreatePortalAccess(projectId: string) {
  return useMutation({
    mutationFn: (input: CreatePortalAccessInput) =>
      apiFetch<PortalAccessResult>(`/projects/${projectId}/portal-access`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/** Public portal fetch - no auth header. */
export async function fetchPortalData(token: string): Promise<PortalData> {
  const res = await fetch(`${API_BASE_URL}/portal/${token}`);
  const body = await res.json().catch(() => ({ success: false }));
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? 'Invalid or expired portal link');
  }
  return body.data as PortalData;
}

export interface SubPortalData {
  project: { id: string; name: string; code: string };
  subcontractor: { id: string; name: string };
  workOrder?: { id: string; woNumber: string; scope: string; contractValue: string; status: string };
  workOrders?: Array<{
    id: string;
    woNumber: string;
    scope: string;
    contractValue: string;
    status: string;
  }>;
  scopes: string[];
  label: string;
  expiresAt: string;
  payments?: Array<{
    id: string;
    billNumber: string;
    status: string;
    total: string;
    paidAmount: string;
  }>;
}

export async function fetchSubPortalData(token: string): Promise<SubPortalData> {
  const res = await fetch(`${API_BASE_URL}/portal/sub/${token}`);
  const body = await res.json().catch(() => ({ success: false }));
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? 'Invalid or expired portal link');
  }
  return body.data as SubPortalData;
}

export function useSubPortalData(token: string) {
  return useQuery({
    queryKey: ['sub-portal', token],
    queryFn: () => fetchSubPortalData(token),
    enabled: !!token,
    retry: false,
  });
}

export function usePortalData(token: string) {
  return useQuery({
    queryKey: expansionKeys.portal(token),
    queryFn: () => fetchPortalData(token),
    enabled: !!token,
    retry: false,
  });
}

/* ------------------------------------------------------------------ */
/* Report schedules                                                    */
/* ------------------------------------------------------------------ */

export function useReportSchedules() {
  return useQuery({
    queryKey: expansionKeys.reportSchedules,
    queryFn: () => apiFetch<ReportSchedule[]>('/analytics/report-schedules'),
  });
}

export function useCreateReportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportScheduleInput) =>
      apiFetch<ReportSchedule>('/analytics/report-schedules', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.reportSchedules }),
  });
}

/* ------------------------------------------------------------------ */
/* Project members (re-export types for convenience)                   */
/* ------------------------------------------------------------------ */

export interface ProjectMemberRow {
  id: string;
  userId: string;
  role: Role;
  user: { id: string; name: string; email: string; role: Role };
}

export type SetProjectMembersInput = {
  members: Array<{ userId: string; role: Role }>;
};
