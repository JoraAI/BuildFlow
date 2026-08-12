/**
 * BuildFlow - Inventory GTM React Query hooks (INVENTORY_HORIZONTAL_PLATFORM Phase 9).
 *
 * 9.1 Customer price lists · 9.2 Quote → SO · 9.4 payment reminders · 9.3 PDFs.
 * All routes are inventory-gated server-side (construction → 403).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface PriceRow {
  id: string;
  customerId: string | null;
  customerName: string | null;
  resourceId: string;
  resourceName: string;
  unit: string;
  rate: number;
  scope: 'CUSTOMER' | 'DEFAULT';
}

export interface QuoteLine {
  id: string;
  resourceId: string;
  itemName: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  gstRate: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string | null;
  customerName: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  quoteDate: string;
  validUntil: string | null;
  subtotal: number;
  gstAmount: number;
  total: number;
  notes: string | null;
  salesOrderId: string | null;
  lines: QuoteLine[];
}

export function usePriceList() {
  return useQuery<PriceRow[]>({
    queryKey: ['inventory', 'price-list'],
    queryFn: () => apiFetch<PriceRow[]>('/inventory/price-list'),
  });
}

export function useUpsertPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId?: string | null; resourceId: string; rate: number }) =>
      apiFetch<PriceRow>('/inventory/price-list', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory', 'price-list'] }),
  });
}

export function useDeletePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: number }>(`/inventory/price-list/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory', 'price-list'] }),
  });
}

/** Effective-rate map for a customer: customer override → default → catalog. */
export function useEffectiveRates(customerId?: string) {
  return useQuery<Record<string, number>>({
    queryKey: ['inventory', 'effective-rates', customerId ?? 'default'],
    queryFn: async () => {
      const rows = await apiFetch<PriceRow[]>('/inventory/price-list');
      const map: Record<string, number> = {};
      for (const r of rows) {
        const applies = customerId ? r.customerId === customerId || r.customerId === null : r.customerId === null;
        if (!applies) continue;
        // Customer override wins; default fills gaps.
        if (!(r.resourceId in map) || r.customerId) map[r.resourceId] = r.rate;
      }
      return map;
    },
  });
}

export function useQuotes() {
  return useQuery<Quote[]>({
    queryKey: ['inventory', 'quotes'],
    queryFn: () => apiFetch<Quote[]>('/inventory/quotes'),
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      quoteNumber?: string;
      customerId?: string;
      customerName: string;
      quoteDate?: string;
      validUntil?: string;
      notes?: string;
      lines: Array<{ resourceId: string; quantity: number; unit: string; rate: number; gstRate?: number }>;
    }) => apiFetch<Quote>('/inventory/quotes', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory', 'quotes'] });
    },
  });
}

export function useQuoteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'send' | 'accept' | 'reject' }) =>
      apiFetch<Quote>(`/inventory/quotes/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory', 'quotes'] }),
  });
}

export function useQuoteToSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ salesOrder: unknown; quote: Quote }>(`/inventory/quotes/${id}/sales-order`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory', 'quotes'] });
      // Phase 9.2: keep the Sales Orders tab in sync (transactionKeys.salesOrders).
      void qc.invalidateQueries({ queryKey: ['transactions', 'sales-orders'] });
    },
  });
}

export function useRemindInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ reminded: boolean }>(`/inventory/invoices/${id}/remind`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
