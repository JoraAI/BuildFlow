/**
 * BuildFlow - Warehouse ops hooks (INVENTORY_HORIZONTAL_PLATFORM Phase 3).
 * Multi-warehouse locations, stock transfers, stock counts, barcode identify.
 * Gated by `multi_warehouse` / `barcode` on the backend (construction 403).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface Warehouse {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  balances: Array<{
    resourceId: string;
    quantity: string;
    resource?: { name: string; unit: string };
  }>;
}

export interface TransferLine {
  id: string;
  resourceId: string;
  itemName: string;
  unit: string;
  quantity: string;
  receivedQty: string;
}

export interface TransferOrder {
  id: string;
  transferNumber: string;
  fromLocationId: string;
  toLocationId: string;
  status: 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  dispatchedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  lines: TransferLine[];
  fromLocation: { id: string; name: string; code: string | null };
  toLocation: { id: string; name: string; code: string | null };
}

export interface StockCountLine {
  id: string;
  resourceId: string;
  itemName: string;
  unit: string;
  systemQty: string;
  countedQty: string;
  variance: string;
}

export interface StockCount {
  id: string;
  countNumber: string;
  locationId: string;
  status: 'DRAFT' | 'APPROVED' | 'CANCELLED';
  countDate: string;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
  lines: StockCountLine[];
  location: { id: string; name: string; code: string | null };
}

export interface BarcodeItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  rate: string;
  sku: string | null;
  itemCode: string | null;
  barcode: string | null;
  hsnSacCode: string | null;
  gstRate: string;
}

export const warehouseKeys = {
  warehouses: ['inventory', 'warehouses'] as const,
  transfers: ['inventory', 'transfers'] as const,
  stockCounts: ['inventory', 'stock-counts'] as const,
  barcode: (code: string) => ['inventory', 'items', 'by-barcode', code] as const,
};
export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      code?: string;
      address?: string;
      isDefault?: boolean;
      isActive?: boolean;
    }) =>
      apiFetch<Warehouse>(`/inventory/warehouses/${input.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.code !== undefined && { code: input.code }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.warehouses }),
  });
}

/* ── 3.2 Stock transfers ──────────────────────────────────────────── */

export function useTransfers() {
  return useQuery<TransferOrder[]>({
    queryKey: warehouseKeys.transfers,
    queryFn: () => apiFetch<TransferOrder[]>('/inventory/transfers'),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fromLocationId: string;
      toLocationId: string;
      notes?: string;
      lines: Array<{ resourceId: string; quantity: number }>;
    }) => apiFetch<TransferOrder>('/inventory/transfers', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: warehouseKeys.transfers });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary'] });
    },
  });
}

export function useTransferAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'dispatch' | 'receive' | 'cancel' }) =>
      apiFetch<TransferOrder>(`/inventory/transfers/${input.id}/${input.action}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: warehouseKeys.transfers });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary'] });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'movements'] });
    },
  });
}


/* ── 3.1 Warehouses ───────────────────────────────────────────────── */

export function useWarehouses() {
  return useQuery<Warehouse[]>({
    queryKey: warehouseKeys.warehouses,
    queryFn: () => apiFetch<Warehouse[]>('/inventory/warehouses'),
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; code?: string; address?: string; isDefault?: boolean }) =>
      apiFetch<Warehouse>('/inventory/warehouses', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.warehouses }),
  });
}
/* ── 3.3 Stock counts ─────────────────────────────────────────────── */

export function useStockCounts() {
  return useQuery<StockCount[]>({
    queryKey: warehouseKeys.stockCounts,
    queryFn: () => apiFetch<StockCount[]>('/inventory/stock-counts'),
  });
}

export function useCreateStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      locationId: string;
      countDate: string;
      notes?: string;
      lines: Array<{ resourceId: string; countedQty: number }>;
    }) => apiFetch<StockCount>('/inventory/stock-counts', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.stockCounts }),
  });
}

export function useStockCountAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'cancel' }) =>
      apiFetch<StockCount>(`/inventory/stock-counts/${input.id}/${input.action}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: warehouseKeys.stockCounts });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary'] });
      void qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'movements'] });
    },
  });
}

/* ── 3.4 Barcode identify ─────────────────────────────────────────── */

export function useBarcodeLookup(code: string) {
  return useQuery<BarcodeItem>({
    queryKey: warehouseKeys.barcode(code),
    queryFn: () => apiFetch<BarcodeItem>(`/inventory/items/by-barcode/${encodeURIComponent(code)}`),
    enabled: code.trim().length > 0,
    retry: false,
  });
}

