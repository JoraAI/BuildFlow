/**
 * BuildFlow — React Query hooks for platform expansion features:
 * change orders, procurement, subcontract, portal, report schedules.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiDownload } from '@/lib/api-client';
import { API_BASE_URL } from '@/constants';
import type {
  CreateChangeOrderInput,
  CreateRequisitionInput,
  CreatePurchaseOrderInput,
  CreateGrnInput,
  CreateSubcontractorInput,
  CreateWorkOrderInput,
  CreateMeasurementInput,
  CreatePortalAccessInput,
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
  subcontractors: ['subcontractors'] as const,
  workOrders: (projectId: string) => ['subcontract', 'work-orders', projectId] as const,
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
}

export interface ChangeOrder {
  id: string;
  number: string;
  title: string;
  reason: string | null;
  status: ApprovalStatus;
  costImpact: string;
  scheduleImpactDays: number;
  createdAt: string;
  lines: ChangeOrderLine[];
  createdByUser?: { id: string; name: string };
}

export interface RequisitionLine {
  id: string;
  resourceId: string;
  quantity: string;
  unit: string;
  resource?: { id: string; name: string };
}

export interface Requisition {
  id: string;
  reqNumber: string;
  status: ApprovalStatus;
  notes: string | null;
  createdAt: string;
  lines: RequisitionLine[];
  purchaseOrders?: { id: string; poNumber: string; status: string }[];
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
  status: string;
  subcontractor: { id: string; name: string; gstin?: string | null };
  _count?: { measurements: number };
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
  createdAt: string;
  lines: MeasurementLine[];
  bills?: { id: string; billNumber: string; status: string }[];
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.changeOrders(projectId) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) }),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expansionKeys.requisitions(projectId) });
      qc.invalidateQueries({ queryKey: expansionKeys.stock(projectId) });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: expansionKeys.workOrders(projectId) }),
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
      apiFetch<Measurement>(
        `/projects/${projectId}/subcontract/measurements/${measurementId}/approve`,
        { method: 'POST', body: JSON.stringify({ createBill: true }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontract', 'measurements'] }),
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

/** Public portal fetch — no auth header. */
export async function fetchPortalData(token: string): Promise<PortalData> {
  const res = await fetch(`${API_BASE_URL}/portal/${token}`);
  const body = await res.json().catch(() => ({ success: false }));
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? 'Invalid or expired portal link');
  }
  return body.data as PortalData;
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
