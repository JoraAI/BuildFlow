import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export type GstPackSummary = {
  id: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  label: string;
  status: 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'FILED';
  notes: string | null;
  sentAt: string | null;
  filedAt: string | null;
  createdAt: string;
  hasSnapshot?: boolean;
};

export type GstPackDetail = GstPackSummary & {
  taxCode?: { short: string; field: string; missing: string };
  bank: Array<{
    id: string;
    entryDate: string;
    paymentMode: string;
    entryType: string;
    direction: string;
    description: string;
    amount: number;
  }>;
  quotes: Array<{
    id: string;
    quoteNumber: string;
    status: string;
    total: number;
    customerName: string;
    quoteDate: string;
  }>;
  journals: Array<{
    id: string;
    entryDate: string;
    description: string | null;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    reference: string | null;
  }>;
  gst: {
    invoiceCount: number;
    billCount: number;
    invoiceTaxable: number;
    invoiceCgst: number;
    invoiceSgst: number;
    invoiceIgst: number;
    invoiceGst: number;
    billGst: number;
    billTaxable?: number;
    billTotal: number;
    b2bCount?: number;
    b2cCount?: number;
    missingHsnLines?: number;
    rateWise?: Array<{ rate: number; taxable: number; tax: number; count: number }>;
    hsnSummary?: Array<{
      hsn: string;
      taxable: number;
      tax: number;
      qty: number;
      lineCount: number;
    }>;
    invoices: Array<{
      id: string;
      number: string;
      date: string;
      clientName?: string;
      clientGstin?: string | null;
      clientState?: string | null;
      gstRate?: number;
      total: number;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
      bucket?: 'B2B' | 'B2C';
      lines?: Array<{
        id: string;
        description: string;
        qty: number;
        rate: number;
        taxable: number;
        gstRate: number;
        hsn: string | null;
      }>;
    }>;
    bills: Array<{
      id: string;
      number: string;
      date: string;
      total: number;
      gst: number;
      vendorName?: string;
      vendorGstin?: string | null;
      taxable?: number;
    }>;
  };
  manualEntries: Array<{
    id: string;
    entryType: string;
    entryDate: string;
    amount: number | null;
    narration: string;
    createdByName: string;
    createdAt: string;
  }>;
  bankTotal: number;
};

export function useAuditorInbox() {
  return useQuery({
    queryKey: ['auditor', 'inbox'],
    queryFn: () => apiFetch<GstPackSummary[]>('/inventory/auditor/inbox'),
  });
}

export function useAuditorPack(packId: string | undefined) {
  return useQuery({
    queryKey: ['auditor', 'pack', packId],
    enabled: Boolean(packId),
    queryFn: () => apiFetch<GstPackDetail>(`/inventory/auditor/inbox/${packId}`),
  });
}

export function useOwnerGstPacks(enabled = true) {
  return useQuery({
    queryKey: ['auditor', 'owner-packs'],
    enabled,
    queryFn: () => apiFetch<GstPackSummary[]>('/inventory/auditor/packs'),
  });
}

export function useCreateGstPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { periodStart: string; periodEnd: string; label?: string; notes?: string }) =>
      apiFetch<GstPackSummary>('/inventory/auditor/packs', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auditor', 'owner-packs'] }),
  });
}

export function useSendGstPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: string) =>
      apiFetch<GstPackSummary>(`/inventory/auditor/packs/${packId}/send`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditor', 'owner-packs'] });
      qc.invalidateQueries({ queryKey: ['auditor', 'inbox'] });
    },
  });
}

export function useDeleteGstPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: string) =>
      apiFetch<{ deleted: true }>(`/inventory/auditor/packs/${packId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auditor', 'owner-packs'] }),
  });
}

export function useUpdateAuditorPackStatus(packId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: 'IN_PROGRESS' | 'FILED') =>
      apiFetch<GstPackSummary>(`/inventory/auditor/inbox/${packId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditor', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['auditor', 'pack', packId] });
    },
  });
}

export function useAddAuditorManualEntry(packId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      entryType: 'JOURNAL' | 'BANK_NOTE' | 'GST_NOTE';
      entryDate: string;
      amount?: number | null;
      narration: string;
    }) =>
      apiFetch(`/inventory/auditor/inbox/${packId}/manual-entries`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auditor', 'pack', packId] }),
  });
}

export function useRevokeAuditor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/inventory/auditor/auditors/${userId}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'users'] }),
  });
}
