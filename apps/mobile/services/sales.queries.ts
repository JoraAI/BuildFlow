/**
 * BuildFlow - Transaction engine hooks (INVENTORY_HORIZONTAL_PLATFORM Phase 2).
 * Sales orders, delivery challans, sales/purchase returns, credit/debit notes.
 * All gated by hasInventoryFeature('sales_orders') on the backend.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface SalesOrderLine {
  id: string;
  resourceId: string;
  itemName: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  gstRate: string;
  deliveredQty: string;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customerId?: string | null;
  customerName: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'INVOICED' | 'CANCELLED';
  orderDate: string;
  expectedDelivery?: string | null;
  notes?: string | null;
  subtotal: string;
  gstAmount: string;
  total: string;
  createdAt: string;
  lines: SalesOrderLine[];
  deliveryChallans: DeliveryChallan[];
}

export interface DeliveryChallan {
  id: string;
  dcNumber: string;
  salesOrderId?: string | null;
  customerName: string;
  status: 'DRAFT' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    resourceId: string;
    itemName: string;
    unit: string;
    quantity: string;
    rate: string;
  }>;
  salesOrder?: { id: string; soNumber: string } | null;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  invoiceId?: string | null;
  customerName: string;
  returnDate: string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  reason?: string | null;
  subtotal: string;
  gstAmount: string;
  total: string;
  createdAt: string;
  lines: Array<{
    id: string;
    resourceId: string;
    itemName: string;
    unit: string;
    quantity: string;
    returnKind: 'GOOD' | 'DAMAGED';
    rate: string;
    gstRate: string;
  }>;
  creditNote?: { id: string; creditNoteNumber: string } | null;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  billId?: string | null;
  vendorName: string;
  returnDate: string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  reason?: string | null;
  total: string;
  createdAt: string;
  lines: Array<{
    id: string;
    resourceId: string;
    itemName: string;
    unit: string;
    quantity: string;
    rate: string;
  }>;
  debitNote?: { id: string; debitNoteNumber: string } | null;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  customerName: string;
  creditDate: string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  total: string;
  createdAt: string;
  salesReturn?: { id: string; returnNumber: string } | null;
}

export interface DebitNote {
  id: string;
  debitNoteNumber: string;
  vendorName: string;
  debitDate: string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  total: string;
  createdAt: string;
  purchaseReturn?: { id: string; returnNumber: string } | null;
}

const transactionKeys = {
  salesOrders: ['transactions', 'sales-orders'] as const,
  deliveryChallans: ['transactions', 'delivery-challans'] as const,
  salesReturns: ['transactions', 'returns', 'sales'] as const,
  purchaseReturns: ['transactions', 'returns', 'purchase'] as const,
  creditNotes: ['transactions', 'notes', 'credit'] as const,
  debitNotes: ['transactions', 'notes', 'debit'] as const,
};

export function invalidateTransactions(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['transactions'] });
  void qc.invalidateQueries({ queryKey: ['projects'] });
  void qc.invalidateQueries({ queryKey: ['invoices'] });
}

/* ── Sales orders ─────────────────────────────────────────────────── */

export function useSalesOrders() {
  return useQuery({
    queryKey: transactionKeys.salesOrders,
    queryFn: () => apiFetch<SalesOrder[]>('/inventory/transactions/sales-orders'),
  });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerId?: string;
      customerName: string;
      orderDate: string;
      expectedDelivery?: string;
      notes?: string;
      lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number; gstRate?: number }>;
    }) =>
      apiFetch<SalesOrder>('/inventory/transactions/sales-orders', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: transactionKeys.salesOrders }),
  });
}

export function useSalesOrderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'cancel' }) =>
      apiFetch<SalesOrder>(`/inventory/transactions/sales-orders/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => invalidateTransactions(qc),
  });
}

export function useInvoiceFromSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input?: { invoiceNumber?: string; dueDate?: string; gstRate?: number; notes?: string };
    }) =>
      apiFetch<{ id: string; invoiceNumber: string; salesOrderId?: string | null; creditLimitWarning?: string }>(
        `/inventory/transactions/sales-orders/${id}/invoice`,
        { method: 'POST', body: JSON.stringify(input ?? {}) },
      ),
    onSuccess: () => invalidateTransactions(qc),
  });
}

/* ── Delivery challans ────────────────────────────────────────────── */

export function useDeliveryChallans() {
  return useQuery({
    queryKey: transactionKeys.deliveryChallans,
    queryFn: () => apiFetch<DeliveryChallan[]>('/inventory/transactions/delivery-challans'),
  });
}

export function useCreateDeliveryChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { salesOrderId: string; notes?: string }) =>
      apiFetch<DeliveryChallan>('/inventory/transactions/delivery-challans', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTransactions(qc),
  });
}

export function useChallanTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, locationId }: { id: string; action: 'dispatch' | 'deliver'; locationId?: string }) =>
      apiFetch<DeliveryChallan & { draftInvoiceId?: string | null }>(
        `/inventory/transactions/delivery-challans/${id}/${action}`,
        {
          method: 'POST',
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.6): dispatch from a specific warehouse.
          body: JSON.stringify(locationId ? { locationId } : {}),
        },
      ),
    onSuccess: () => invalidateTransactions(qc),
  });
}

export function useChallanReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      lines,
      locationId,
    }: {
      id: string;
      lines: Array<{ resourceId: string; quantity: number; reason?: string; returnKind?: 'GOOD' | 'DAMAGED' }>;
      locationId?: string;
    }) =>
      apiFetch<DeliveryChallan>(`/inventory/transactions/delivery-challans/${id}/return`, {
        method: 'POST',
        body: JSON.stringify({ lines, locationId }),
      }),
    onSuccess: () => invalidateTransactions(qc),
  });
}

/* ── Returns ──────────────────────────────────────────────────────── */

export function useSalesReturns() {
  return useQuery({
    queryKey: transactionKeys.salesReturns,
    queryFn: () => apiFetch<SalesReturn[]>('/inventory/transactions/returns/sales'),
  });
}

export interface ValidatedScanResult {
  resource: {
    id: string;
    name: string;
    unit: string;
    barcode?: string | null;
    sku?: string | null;
    itemCode?: string | null;
    catalogRate: number;
  };
  matchingLines: Array<{
    invoiceId: string;
    invoiceNumber: string;
    clientName: string;
    invoiceDate: string;
    invoiceLineItemId: string;
    dispatchedQty: number;
    rate: number;
    gstRate: number;
    amount: number;
  }>;
  totalDispatched: number;
  totalPreviouslyReturned: number;
  maxReturnable: number;
  isValidDispatch: boolean;
}

export function useValidateReturnScan() {
  return useMutation({
    mutationFn: (input: { barcode: string; invoiceId?: string; customerId?: string }) =>
      apiFetch<ValidatedScanResult>('/inventory/transactions/returns/validate-scan', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useApproveSalesReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ returnId, data }: { returnId: string; data?: { targetLocationId?: string; notes?: string } }) =>
      apiFetch<{ salesReturn: SalesReturn; approved: boolean }>(`/inventory/transactions/returns/sales/${returnId}/approve`, {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    onSuccess: () => invalidateTransactions(qc),
  });
}

export function useCreateSalesReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      invoiceId: string;
      returnDate: string;
      reason?: string;
      targetLocationId?: string;
      status?: 'DRAFT' | 'PENDING_APPROVAL' | 'ISSUED';
      lines: Array<{
        resourceId: string;
        quantity: number;
        unit: string;
        rate: number;
        gstRate?: number;
        returnKind: 'GOOD' | 'DAMAGED';
      }>;
    }) =>
      apiFetch<{ salesReturn: SalesReturn; creditNoteId: string }>('/inventory/transactions/returns/sales', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTransactions(qc),
  });
}

export function usePurchaseReturns() {
  return useQuery({
    queryKey: transactionKeys.purchaseReturns,
    queryFn: () => apiFetch<PurchaseReturn[]>('/inventory/transactions/returns/purchase'),
  });
}

export function useCreatePurchaseReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      billId: string;
      returnDate: string;
      reason?: string;
      lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number; gstRate?: number }>;
    }) =>
      apiFetch<{ purchaseReturn: PurchaseReturn; debitNoteId: string }>('/inventory/transactions/returns/purchase', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTransactions(qc),
  });
}

/* ── Notes ────────────────────────────────────────────────────────── */

export function useCreditNotes() {
  return useQuery({
    queryKey: transactionKeys.creditNotes,
    queryFn: () => apiFetch<CreditNote[]>('/inventory/transactions/notes/credit'),
  });
}

export function useDebitNotes() {
  return useQuery({
    queryKey: transactionKeys.debitNotes,
    queryFn: () => apiFetch<DebitNote[]>('/inventory/transactions/notes/debit'),
  });
}

/** INVENTORY_HORIZONTAL_PLATFORM (Phase 5.4): issue a DRAFT note (DRAFT → ISSUED). */
export function useIssueCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CreditNote>(`/inventory/transactions/notes/credit/${id}/issue`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: transactionKeys.creditNotes }),
  });
}

export function useIssueDebitNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DebitNote>(`/inventory/transactions/notes/debit/${id}/issue`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: transactionKeys.debitNotes }),
  });
}

