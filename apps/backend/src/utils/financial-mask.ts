/**
 * Strip monetary fields when the caller's role lacks financial permissions.
 * Used by controllers after services return full rows (deny-by-default).
 */
import type { Role } from '@buildflow/shared';
import { hasPermission } from '../lib/permissions';

export async function canViewAmounts(companyId: string, role: Role | string): Promise<boolean> {
  return hasPermission(companyId, role as Role, 'financials.view_amounts');
}

export async function canViewBudget(companyId: string, role: Role | string): Promise<boolean> {
  return hasPermission(companyId, role as Role, 'financials.view_budget');
}

export async function canViewBoqRates(companyId: string, role: Role | string): Promise<boolean> {
  return hasPermission(companyId, role as Role, 'boq.view_rates');
}

export async function canViewProcurementRates(
  companyId: string,
  role: Role | string,
): Promise<boolean> {
  return hasPermission(companyId, role as Role, 'procurement.view_rates');
}

/** Null out BOQ rate/amount fields. */
export function maskBoqMoneyFields<T extends Record<string, unknown>>(
  item: T,
  canViewRates: boolean,
): T {
  if (canViewRates) return item;
  return { ...item, rate: null, amount: null };
}

/** Null out estimate money summary fields. */
export function maskEstimateMoneyFields<T extends Record<string, unknown>>(
  estimate: T,
  canViewMoney: boolean,
): T {
  if (canViewMoney) return estimate;
  const next = { ...estimate } as Record<string, unknown>;
  for (const key of [
    'grandTotal',
    'subtotal',
    'gstAmount',
    'total',
    'materialCost',
    'labourCost',
    'equipmentCost',
    'overheadAmount',
    'profitAmount',
  ]) {
    if (key in next) next[key] = null;
  }
  return next as T;
}

/** Null out invoice money fields. */
export function maskInvoiceMoneyFields<T extends Record<string, unknown>>(
  invoice: T,
  canViewMoney: boolean,
): T {
  if (canViewMoney) return invoice;
  const next = { ...invoice } as Record<string, unknown>;
  for (const key of [
    'subtotal',
    'gstAmount',
    'tdsAmount',
    'total',
    'paidAmount',
    'retentionPct',
    'retentionAmount',
  ]) {
    if (key in next) next[key] = null;
  }
  return next as T;
}

/** Strip project budget when caller lacks view_budget. */
export function maskProjectBudget<T extends Record<string, unknown>>(
  project: T,
  canBudget: boolean,
): T {
  if (canBudget) return project;
  return { ...project, budget: null };
}

/** Strip project summary money KPIs. */
export function maskProjectSummaryMoney<T extends Record<string, unknown>>(
  summary: T,
  canAmounts: boolean,
  canBudget: boolean,
): T {
  const next = { ...summary } as Record<string, unknown>;
  if (!canBudget) {
    next.budgetUtilizationPct = null;
  }
  if (!canAmounts) {
    next.approvedEstimateTotal = null;
    next.estimateVsActualVariance = null;
    next.committedSpend = null;
    next.paidSpend = null;
  }
  return next as T;
}

/** Strip stock catalog / cost money fields. */
export function maskStockMoneyFields<T extends Record<string, unknown>>(
  row: T,
  canViewRates: boolean,
): T {
  if (canViewRates) return row;
  return {
    ...row,
    catalogRate: null,
    costPrice: null,
    unitCost: null,
    inventoryValue: null,
    mrp: null,
  };
}
