/** Pure URL helpers (no expo-router) — safe for unit tests. */

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

export function reportDetailHref(reportId: string, returnTo?: string): string {
  return withReturnTo(`/reports/${reportId}`, returnTo);
}

export function createReportHref(projectId: string): string {
  return `/reports/create?projectId=${encodeURIComponent(projectId)}&reset=${Date.now()}`;
}
