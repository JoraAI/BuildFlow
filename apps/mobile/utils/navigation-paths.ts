/** Pure URL helpers (no expo-router) - safe for unit tests. */

export function parseReturnTo(param: string | string[] | undefined): string | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function withReturnTo(href: string, returnTo?: string): string {
  if (!returnTo) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}returnTo=${encodeURIComponent(returnTo)}`;
}

export function projectTabHref(projectId: string, tab: string): string {
  return `/projects/${projectId}?tab=${tab}`;
}

export function billDetailHref(billId: string, returnTo?: string): string {
  return withReturnTo(`/accounting/bill/${billId}`, returnTo);
}

export function invoiceDetailHref(invoiceId: string, returnTo?: string): string {
  return withReturnTo(`/accounting/invoice/${invoiceId}`, returnTo);
}

/** Inventory shell: stay under /inventory so (app) layout does not redirect to Stock. */
export function inventoryBillDetailHref(billId: string, returnTo?: string): string {
  return withReturnTo(`/inventory/bills/${billId}`, returnTo);
}

export function inventoryInvoiceDetailHref(invoiceId: string, returnTo?: string): string {
  return withReturnTo(`/inventory/invoices/${invoiceId}`, returnTo);
}

export function inventoryStockItemHref(resourceId: string, locationId?: string): string {
  const base = `/inventory/stock/${resourceId}`;
  return locationId ? `${base}?locationId=${encodeURIComponent(locationId)}` : base;
}

export type InventoryListParams = {
  q?: string | null;
  status?: string | null;
  tab?: string | null;
  focus?: string | null;
};

function usableListParam(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
  return trimmed;
}

/** Build an inventory list URL; omits empty values and status=ALL. */
export function inventoryListHref(base: string, params?: InventoryListParams): string {
  const qs = new URLSearchParams();
  const q = usableListParam(params?.q);
  if (q) qs.set('q', q);
  const status = usableListParam(params?.status);
  if (status && status.toUpperCase() !== 'ALL') qs.set('status', status);
  const tab = usableListParam(params?.tab);
  if (tab) qs.set('tab', tab);
  const focus = usableListParam(params?.focus);
  if (focus) qs.set('focus', focus);
  const encoded = qs.toString();
  return encoded ? `${base}?${encoded}` : base;
}

export function inventorySalesHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/sales', params);
}

export function inventoryInvoicesHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/invoices', params);
}

export function inventoryBillsHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/bills', params);
}

export function inventoryProcurementHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/procurement', params);
}

export function inventoryMaterialsHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/materials', params);
}

export function inventoryPartiesHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/parties', params);
}

export function inventoryQuotesHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/quotes', params);
}

export function inventoryWarehouseHref(params?: InventoryListParams): string {
  return inventoryListHref('/inventory/warehouse', params);
}

export function reportDetailHref(reportId: string, returnTo?: string): string {
  return withReturnTo(`/reports/${reportId}`, returnTo);
}

/** Open the daily-report wizard. Optional `date` (YYYY-MM-DD) prefills the report date. */
export function createReportHref(projectId: string, opts?: { date?: string }): string {
  const params = new URLSearchParams();
  params.set('projectId', projectId);
  params.set('reset', String(Date.now()));
  if (opts?.date) params.set('date', opts.date);
  return `/reports/create?${params.toString()}`;
}

/**
 * Estimate wizard lives on a single Expo route that stays mounted.
 * `reset` must change on every open so a new estimate does not reuse
 * the previous wizard's estimate id, line items, or step.
 */
export function createEstimateHref(opts: {
  projectId: string;
  fromProposal?: string;
  estimateId?: string;
}): string {
  const params = new URLSearchParams();
  params.set('projectId', opts.projectId);
  params.set('reset', String(Date.now()));
  if (opts.fromProposal) params.set('fromProposal', opts.fromProposal);
  if (opts.estimateId) params.set('estimateId', opts.estimateId);
  return `/(app)/estimation/create?${params.toString()}`;
}
