/**
 * BuildFlow - Inventory AI React Query hooks (INVENTORY_HORIZONTAL_PLATFORM Phase 7).
 *
 * 7.1 Document OCR → draft vendor bill (extract + create-from-draft).
 * 7.2 AI import column mapping (preview + confirm).
 * 7.3 Anomaly hints (dashboard strip).
 *
 * All routes are inventory-gated server-side (construction → 403).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface InventoryBillDraftLine {
  description: string;
  hsn?: string;
  unit?: string;
  quantity: number;
  rate: number;
  gstRate: number;
  amount: number;
  matchedResourceId?: string | null;
  matchedResourceName?: string | null;
}

export interface InventoryBillDraft {
  vendorName: string;
  vendorGstin?: string | null;
  billNumber?: string | null;
  billDate?: string | null;
  dueDate?: string | null;
  subtotal: number;
  gstAmount: number;
  tdsAmount: number;
  total: number;
  category: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'OTHER';
  poNumberHint?: string | null;
  grnNumberHint?: string | null;
  confidence: number;
  notes?: string | null;
  filename?: string | null;
  lines: InventoryBillDraftLine[];
  matchedPO?: { id: string; poNumber: string; vendorName: string; totalAmount: number } | null;
  matchedGRN?: { id: string; grnNumber: string; receivedDate: string } | null;
}

export interface ImportMappingPreview {
  headers: string[];
  mapping: Record<string, string>;
  sampleRows: Array<Record<string, string>>;
  rowCount: number;
  purpose: 'CATALOG' | 'OPENING';
  notes: string;
}

export interface AnomalyHint {
  type: 'PO_RATE' | 'COUNT_VARIANCE' | 'OVERDUE_INVOICE';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  referenceId?: string;
  referenceNumber?: string;
}

export function useExtractInvoiceBill() {
  return useMutation({
    mutationFn: (input: {
      fileContent: string;
      filename: string;
      contentType: string;
      poNumberHint?: string;
      grnNumberHint?: string;
    }) =>
      apiFetch<{ draft: InventoryBillDraft | null; notes: string }>('/inventory/ai/bills/extract', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useCreateBillFromDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { draft: InventoryBillDraft; vendorId?: string; billNumber?: string; billDate?: string }) =>
      apiFetch<{ bill: unknown }>('/inventory/ai/bills/create-from-draft', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects', 'bills'] });
      void qc.invalidateQueries({ queryKey: ['inventory', 'analytics', 'dashboard'] });
    },
  });
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (input: { fileContent: string; filename: string; contentType: string; purpose: 'CATALOG' | 'OPENING' }) =>
      apiFetch<ImportMappingPreview>('/inventory/ai/import/preview', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useImportConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mode: 'CATALOG' | 'OPENING';
      mapping: Record<string, string>;
      rows: Array<Record<string, string>>;
      locationId?: string;
    }) =>
      apiFetch<{ created?: number; skipped?: number; applied?: number }>('/inventory/ai/import/confirm', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resources'] });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary'] });
      void qc.invalidateQueries({ queryKey: ['inventory', 'analytics', 'dashboard'] });
    },
  });
}

export function useInventoryAnomalies() {
  return useQuery<AnomalyHint[]>({
    queryKey: ['inventory', 'ai', 'anomalies'],
    queryFn: () => apiFetch<AnomalyHint[]>('/inventory/ai/anomalies'),
    staleTime: 2 * 60 * 1000,
  });
}
