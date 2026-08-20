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
