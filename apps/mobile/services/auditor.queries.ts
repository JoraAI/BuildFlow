import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDownload, apiFetch } from '@/lib/api-client';
import { toast } from '@/components/ui';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type GstPackSummary = {
  id: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  label: string;
  status: 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'FILED';
  notes: string | null;
  openingCashBalance?: number | null;
  sentAt: string | null;
  filedAt: string | null;
  createdAt: string;
  hasSnapshot?: boolean;
};

export type GstPackDetail = GstPackSummary & {
  taxCode?: { short: string; field: string; missing: string };
  bankIn?: number;
  bankOut?: number;
  bankNet?: number;
  bankClosing?: number;
  suggestedOpeningCashBalance?: number | null;
  bank: Array<{
    id: string;
    entryDate: string;
    paymentMode: string;
    entryType: string;
    direction: string;
    description: string;
    amount: number;
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
    creditNoteCount?: number;
    debitNoteCount?: number;
    creditNoteGst?: number;
    debitNoteGst?: number;
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
      lines?: Array<{
        description: string;
        qty: number;
        taxable: number;
        gstRate: number;
        hsn: string | null;
      }>;
    }>;
    creditNotes?: Array<{
      id: string;
      number: string;
      date: string;
      partyName: string;
      partyGstin: string | null;
      taxable: number;
      total: number;
      gst: number;
      cgst: number;
      sgst: number;
      igst: number;
    }>;
    debitNotes?: Array<{
      id: string;
      number: string;
      date: string;
      partyName: string;
      partyGstin: string | null;
      taxable: number;
      total: number;
      gst: number;
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

export function useAuditorPack(packId: string | undefined, opts?: { asOwner?: boolean }) {
  const asOwner = Boolean(opts?.asOwner);
  return useQuery({
    queryKey: ['auditor', 'pack', packId, asOwner ? 'owner' : 'inbox'],
    enabled: Boolean(packId),
    queryFn: () =>
      apiFetch<GstPackDetail>(
        asOwner ? `/inventory/auditor/packs/${packId}` : `/inventory/auditor/inbox/${packId}`,
      ),
  });
}

export function useOwnerGstPacks(enabled = true) {
  return useQuery({
    queryKey: ['auditor', 'owner-packs'],
    enabled,
    queryFn: () => apiFetch<GstPackSummary[]>('/inventory/auditor/packs'),
  });
}

export function useUpdateGstPackDraft(packId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { label?: string; notes?: string | null; openingCashBalance?: number | null }) =>
      apiFetch<GstPackSummary>(`/inventory/auditor/packs/${packId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditor', 'owner-packs'] });
      qc.invalidateQueries({ queryKey: ['auditor', 'pack', packId] });
    },
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

export type SendGstPackResult = GstPackSummary & {
  missingHsnLines?: number;
  hsnWarning?: string | null;
};

export function useSendGstPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: string) =>
      apiFetch<SendGstPackResult>(`/inventory/auditor/packs/${packId}/send`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditor', 'owner-packs'] });
      qc.invalidateQueries({ queryKey: ['auditor', 'inbox'] });
    },
  });
}

async function shareDownloadedFile(uri: string | null, filename: string, mimeType: string) {
  if (uri && (await Sharing.isAvailableAsync())) {
    try {
      await Sharing.shareAsync(uri, { mimeType });
      toast.success(`${filename} ready to share`);
      return;
    } catch (shareErr) {
      const msg = shareErr instanceof Error ? shareErr.message : '';
      if (/cancel|dismiss/i.test(msg)) {
        toast.success(`${filename} saved on this device`);
        return;
      }
      throw shareErr;
    }
  }
  toast.success(Platform.OS === 'web' ? `${filename} download started` : `${filename} saved to device`);
}

/**
 * Download GSTR-1 for GST Returns Offline Tool:
 * - gstr1-json → portal/offline JSON
 * - csv → zip of section-wise CSVs (b2b, b2cs, cdnr, hsn…)
 */
export async function downloadGstPackExport(
  packId: string,
  format: 'gstr1-json' | 'csv',
  opts?: { asOwner?: boolean },
): Promise<void> {
  const base = opts?.asOwner
    ? `/inventory/auditor/packs/${packId}/export`
    : `/inventory/auditor/inbox/${packId}/export`;
  const mime = format === 'csv' ? 'application/zip' : 'application/json';
  const filename =
    format === 'csv' ? `gstr1-offline-${packId}.zip` : `gstr1-${packId}.json`;
  toast.info(format === 'csv' ? 'Preparing GST Offline CSV zip…' : 'Preparing GSTR-1 JSON…');
  try {
    const uri = await apiDownload(`${base}?format=${format}`, filename, mime);
    await shareDownloadedFile(uri, filename, mime);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not download export');
  }
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
