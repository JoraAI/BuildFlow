/**
 * BuildFlow - Inventory analytics React Query hooks
 * (INVENTORY_HORIZONTAL_PLATFORM Phase 6).
 *
 * 6.1 Executive dashboard (Stock home cards).
 * 6.2 Stock health (dead/slow) + warehouse value reports.
 * 6.3 Margin report + purchase price history.
 *
 * All routes are inventory-gated server-side (construction → 403).
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export const inventoryAnalyticsKeys = {
  dashboard: ['inventory', 'analytics', 'dashboard'] as const,
  stockHealth: (days: number, locationId?: string) =>
    ['inventory', 'analytics', 'stock-health', days, locationId ?? 'all'] as const,
  warehouseValue: ['inventory', 'analytics', 'warehouse'] as const,
  margin: ['inventory', 'analytics', 'margin'] as const,
  purchaseHistory: ['inventory', 'analytics', 'purchase-history'] as const,
};

export interface InventoryDashboard {
  inventoryValue: number;
  salesToday: number;
  purchasesToday: number;
  receivables: number;
  payables: number;
  lowStockCount: number;
  deadStockCount: number;
}

export interface StockHealthRow {
  resourceId: string;
  name: string;
  unit: string;
  onHand: number;
  unitCost: number;
  value: number;
  daysSinceLastOut: number | null;
  classification: 'ACTIVE' | 'SLOW' | 'DEAD';
}

export interface WarehouseValueRow {
  locationId: string;
  name: string;
  value: number;
  itemCount: number;
}

export interface MarginRow {
  resourceId: string;
  name: string;
  unit: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  margin: number;
  marginPct: number;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): 'BILLED' when resource-linked
   *  invoice lines exist (billed net), else 'CATALOG' (qty sold × catalog rate). */
  revenueSource?: 'BILLED' | 'CATALOG';
}

export interface PurchaseHistoryRow {
  resourceId: string;
  name: string;
  unit: string;
  lastBuyRate: number;
  lastBuyDate: string | null;
  currentWac: number;
  wacVsLastBuy: number;
}

export function useInventoryDashboard() {
  return useQuery<InventoryDashboard>({
    queryKey: inventoryAnalyticsKeys.dashboard,
    queryFn: () => apiFetch<InventoryDashboard>('/inventory/analytics/dashboard'),
  });
}

export function useStockHealthReport(days: number, locationId?: string) {
  return useQuery<StockHealthRow[]>({
    queryKey: inventoryAnalyticsKeys.stockHealth(days, locationId),
    queryFn: () => {
      const params = new URLSearchParams({ days: String(days) });
      if (locationId) params.set('locationId', locationId);
      return apiFetch<StockHealthRow[]>(`/inventory/analytics/reports/stock-health?${params.toString()}`);
    },
  });
}

export function useWarehouseValueReport() {
  return useQuery<WarehouseValueRow[]>({
    queryKey: inventoryAnalyticsKeys.warehouseValue,
    queryFn: () => apiFetch<WarehouseValueRow[]>('/inventory/analytics/reports/warehouse'),
  });
}

export function useMarginReport() {
  return useQuery<MarginRow[]>({
    queryKey: inventoryAnalyticsKeys.margin,
    queryFn: () => apiFetch<MarginRow[]>('/inventory/analytics/reports/margin'),
  });
}

export function usePurchaseHistoryReport() {
  return useQuery<PurchaseHistoryRow[]>({
    queryKey: inventoryAnalyticsKeys.purchaseHistory,
    queryFn: () => apiFetch<PurchaseHistoryRow[]>('/inventory/analytics/reports/purchase-history'),
  });
}
