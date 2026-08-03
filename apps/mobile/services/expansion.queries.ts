/**
 * BuildFlow - React Query hooks for platform expansion features:
 * change orders, procurement, subcontract, portal, report schedules.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiDownload } from '@/lib/api-client';
import { API_BASE_URL } from '@/constants';
import {
  invalidateChangeOrderImpact,
  invalidateProjectAccounting,
  invalidateProjectBoq,
  invalidateProjectCore,
  invalidateProjectProcurement,
  invalidateProjectSubcontract,
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
  stock: (projectId: string) => ['procurement', 'stock', projectId] as const,
  stockSummary: (projectId: string) => ['procurement', 'stock', 'summary', projectId] as const,
  stockMovements: (projectId: string, resourceId: string) =>
    ['procurement', 'stock', 'movements', projectId, resourceId] as const,
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
  received: number;
  issued: number;
  balance: number;
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

export function measurementBookPdfPath(projectId: string) {
  return `/reports/pdf/projects/${projectId}/measurement-book`;
}

export function abstractSheetPdfPath(projectId: string) {
  return `/reports/pdf/projects/${projectId}/abstract-sheet`;
}

export function subcontractMeasurementBookPdfPath(projectId: string, workOrderId: string) {
  return `/reports/pdf/projects/${projectId}/subcontract/work-orders/${workOrderId}/measurement-book`;
}

export function subcontractAbstractSheetPdfPath(projectId: string, workOrderId: string) {
  return `/reports/pdf/projects/${projectId}/subcontract/work-orders/${workOrderId}/abstract-sheet`;
}

export async function downloadMeasurementBookPdf(projectId: string) {
  return apiDownload(
    measurementBookPdfPath(projectId),
    `measurement-book-${projectId}.pdf`,
    'application/pdf',
  );
}

export async function downloadAbstractSheetPdf(projectId: string) {
  return apiDownload(
    abstractSheetPdfPath(projectId),
    `abstract-sheet-${projectId}.pdf`,
    'application/pdf',
  );
}

export async function downloadSubcontractMeasurementBookPdf(projectId: string, workOrderId: string) {
  return apiDownload(
    subcontractMeasurementBookPdfPath(projectId, workOrderId),
    `sub-measurement-book-${workOrderId}.pdf`,
    'application/pdf',
  );
}

export async function downloadSubcontractAbstractSheetPdf(projectId: string, workOrderId: string) {
  return apiDownload(
    subcontractAbstractSheetPdfPath(projectId, workOrderId),
    `sub-abstract-${workOrderId}.pdf`,
    'application/pdf',
  );
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) }),
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

export function useRejectChangeOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ changeOrderId, reason }: { changeOrderId: string; reason: string }) =>
      apiFetch<ChangeOrder>(`/projects/${projectId}/change-orders/${changeOrderId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) }),
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
      qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) }),
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
    onSuccess: () => invalidateProjectProcurement(qc, projectId),
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
    onSuccess: () => invalidateProjectProcurement(qc, projectId),
  });
}

export function useStock(projectId: string) {
  return useQuery({
    queryKey: expansionKeys.stock(projectId),
    queryFn: () => apiFetch<StockLocation[]>(`/projects/${projectId}/procurement/stock`),
    enabled: !!projectId,
  });
}

export function useStockSummary(projectId: string) {
  return useQuery({
    queryKey: expansionKeys.stockSummary(projectId),
    queryFn: () => apiFetch<StockSummaryRow[]>(`/projects/${projectId}/procurement/stock/summary`),
    enabled: !!projectId,
  });
}

export function useStockMovements(projectId: string, resourceId: string | undefined) {
  return useQuery({
    queryKey: expansionKeys.stockMovements(projectId, resourceId ?? ''),
    queryFn: () =>
      apiFetch<StockMovementRow[]>(
        `/projects/${projectId}/procurement/stock/movements?resourceId=${resourceId}&limit=50`,
      ),
    enabled: !!projectId && !!resourceId,
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
