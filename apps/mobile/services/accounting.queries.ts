/**
 * BuildFlow - React Query hooks for invoices, bills, and financial reports.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { invalidateProjectBoq, invalidateProjectCore, invalidateBillPaymentImpact, invalidateAnalyticsDashboard } from '@/lib/project-query-invalidation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  gstRate: number;
  hsnSacCode?: string | null;
}

export interface Invoice {
  id: string;
  projectId: string;
  invoiceNumber: string;
  clientName: string;
  clientGstin?: string | null;
  invoiceDate: string;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  tdsRate: number;
  tdsAmount: number;
  total: number;
  paidAmount: number;
  notes?: string | null;
  lineItems?: InvoiceLineItem[];
}

export interface Bill {
  id: string;
  projectId: string;
  billNumber: string;
  vendorName: string;
  vendorGstin?: string | null;
  billDate: string;
  dueDate?: string | null;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  subtotal: number;
  gstAmount: number;
  tdsRate: number;
  tdsAmount: number;
  total: number;
  paidAmount: number;
  paidAt?: string | null;
  retentionAmount: number;
  advanceRecoveryAmount: number;
  workOrderId?: string | null;
  measurementId?: string | null;
  isRetentionRelease: boolean;
  category: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'OTHER';
  attachmentUrl?: string | null;
  approvedBy?: string | null;
}

export type InvoiceType = 'STANDARD' | 'RUNNING_ACCOUNT' | 'MILESTONE';

export interface InvoiceInput {
  invoiceNumber?: string;
  clientName: string;
  clientGstin?: string;
  clientState?: string;
  invoiceDate: string;
  dueDate: string;
  projectId: string;
  gstRate?: number;
  tdsEnabled?: boolean;
  notes?: string;
  invoiceType?: InvoiceType;
  raSequence?: number;
  milestoneLabel?: string;
  retentionPct?: number;
  lineItems: Array<{
    boqItemId?: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstRate?: number;
    hsnSacCode?: string;
    previousQty?: number;
    currentQty?: number;
    cumulativeQty?: number;
  }>;
}

export interface BillInput {
  billNumber?: string;
  vendorName: string;
  vendorGstin?: string;
  billDate: string;
  dueDate?: string;
  projectId: string;
  subtotal: number;
  gstAmount?: number;
  tdsRate?: number;
  tdsAmount?: number;
  category: Bill['category'];
  // PROC-B3/B5: Link to PO and optional vendor invoice attachment
  purchaseOrderId?: string;
  attachmentUrl?: string;
}

// ---------------------------------------------------------------------------
// Invoice hooks
// ---------------------------------------------------------------------------
export function useInvoices(projectId: string) {
  return useQuery({
    queryKey: ['invoices', 'list', projectId] as const,
    queryFn: () => apiFetch<Invoice[]>(`/projects/${projectId}/invoices`),
    enabled: !!projectId,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', 'detail', id] as const,
    queryFn: () => apiFetch<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvoiceInput) =>
      apiFetch<Invoice>(`/projects/${input.projectId}/invoices`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices', 'list', data.projectId] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InvoiceInput> }) =>
      apiFetch<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', data.id] });
      qc.invalidateQueries({ queryKey: ['invoices', 'list', data.projectId] });
    },
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Invoice>(`/invoices/${id}/send`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', data.id] });
      qc.invalidateQueries({ queryKey: ['invoices', 'list', data.projectId] });
      invalidateProjectBoq(qc, data.projectId);
      invalidateProjectCore(qc, data.projectId);
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      apiFetch<Invoice>(`/invoices/${id}/record-payment`, { method: 'POST', body: JSON.stringify({ amount }) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', data.id] });
      qc.invalidateQueries({ queryKey: ['invoices', 'list', data.projectId] });
      invalidateProjectBoq(qc, data.projectId);
      invalidateProjectCore(qc, data.projectId);
      invalidateAnalyticsDashboard(qc);
    },
  });
}

// ---------------------------------------------------------------------------
// Bill hooks
// ---------------------------------------------------------------------------
export function useBills(projectId: string) {
  return useQuery({
    queryKey: ['bills', 'list', projectId] as const,
    queryFn: () => apiFetch<Bill[]>(`/projects/${projectId}/bills`),
    enabled: !!projectId,
  });
}

export function useBill(id: string) {
  return useQuery({
    queryKey: ['bills', 'detail', id] as const,
    queryFn: () => apiFetch<Bill>(`/bills/${id}`),
    enabled: !!id,
  });
}

export function useBillSummary(projectId: string) {
  return useQuery({
    queryKey: ['bills', 'summary', projectId] as const,
    queryFn: () => apiFetch<Record<string, number>>(`/projects/${projectId}/bills/summary`),
    enabled: !!projectId,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BillInput) =>
      apiFetch<Bill>(`/projects/${input.projectId}/bills`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bills', 'list', data.projectId] });
      qc.invalidateQueries({ queryKey: ['bills', 'summary', data.projectId] });
    },
  });
}

export function useApproveBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Bill>(`/bills/${id}/approve`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bills', 'detail', data.id] });
      qc.invalidateQueries({ queryKey: ['bills', 'list', data.projectId] });
      qc.invalidateQueries({ queryKey: ['bills', 'summary', data.projectId] });
      invalidateBillPaymentImpact(qc, data.projectId);
    },
  });
}

export function useRejectBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Bill>(`/bills/${id}/reject`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bills', 'detail', data.id] });
      invalidateBillPaymentImpact(qc, data.projectId);
    },
  });
}

export function useRecordBillPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      apiFetch<Bill>(`/bills/${id}/record-payment`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bills', 'detail', data.id] });
      invalidateBillPaymentImpact(qc, data.projectId);
    },
  });
}

export function usePayBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Bill>(`/bills/${id}/pay`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bills', 'detail', data.id] });
      invalidateBillPaymentImpact(qc, data.projectId);
    },
  });
}

// ---------------------------------------------------------------------------
// Financial report hooks
// ---------------------------------------------------------------------------
export function useProfitLoss(projectId: string) {
  return useQuery({
    queryKey: ['financials', 'pl', projectId] as const,
    queryFn: () => apiFetch<unknown>(`/projects/${projectId}/financials/pl`),
    enabled: !!projectId,
  });
}

export function useCashFlow(projectId: string) {
  return useQuery({
    queryKey: ['financials', 'cashflow', projectId] as const,
    queryFn: () =>
      apiFetch<{ months: Array<{ month: string; inflow: number; outflow: number; net: number }> }>(
        `/projects/${projectId}/financials/cashflow`,
      ),
    enabled: !!projectId,
  });
}

export interface EstimateVsActualRow {
  section: string;
  type: string;
  estimated: number;
  actual: number;
  variance: number;
  variancePct: number;
}

export interface EstimateVsActual {
  completionPct: number;
  sections: EstimateVsActualRow[];
  totalEstimated: number;
  totalActual: number;
  totalVariance: number;
  flagged: string[];
}

export function useEstimateVsActual(projectId: string) {
  return useQuery({
    queryKey: ['financials', 'estimate-vs-actual', projectId] as const,
    queryFn: () => apiFetch<EstimateVsActual>(`/projects/${projectId}/financials/estimate-vs-actual`),
    enabled: !!projectId,
  });
}

export interface CompanyDashboard {
  totalProjects: number;
  activeProjects: number;
  totalInvoiced: number;
  totalCollected: number;
  totalBilled: number;
  totalPaid: number;
  outstandingReceivable: number;
  outstandingPayable: number;
  projectSummaries: Array<{
    id: string;
    name: string;
    status: string;
    budget: number;
    billed: number;
    collected: number;
    variance: number;
  }>;
}

export function useCompanyDashboard() {
  return useQuery({
    queryKey: ['financials', 'company-dashboard'] as const,
    queryFn: () => apiFetch<CompanyDashboard>('/company/financials/dashboard'),
  });
}

export function useGstReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['financials', 'gst-report', from, to] as const,
    queryFn: () =>
      apiFetch<{
        rows: Array<{
          invoiceNumber: string;
          invoiceDate: string;
          clientGstin: string;
          clientName: string;
          taxableValue: number;
          cgst: number;
          sgst: number;
          igst: number;
          totalTax: number;
          invoiceValue: number;
        }>;
        totalTaxableValue: number;
        totalCgst: number;
        totalSgst: number;
        totalIgst: number;
        totalTax: number;
        totalInvoiceValue: number;
      // FIX (MOB-H9): Pass from/to as query params so the date range applies.
      }>(`/company/financials/gst-report${from || to ? `?from=${from ?? ''}&to=${to ?? ''}` : ''}`),
  });
}

export function useTdsReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['financials', 'tds-report', from, to] as const,
    queryFn: () =>
      apiFetch<{
        rows: Array<{
          billNumber: string;
          billDate: string;
          vendorName: string;
          vendorGstin: string;
          amountPaid: number;
          tdsRate: number;
          tdsAmount: number;
          category: string;
        }>;
        totalAmountPaid: number;
        totalTdsDeducted: number;
      // FIX (MOB-H9): Pass from/to as query params so the date range applies.
      }>(`/company/financials/tds-report${from || to ? `?from=${from ?? ''}&to=${to ?? ''}` : ''}`),
  });
}
