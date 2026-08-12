/**
 * Shared React Query invalidation bundles for cross-module project mutations.
 */
import type { QueryClient } from '@tanstack/react-query';

export function invalidateProjectCore(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['projects', projectId] });
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'summary'] });
  qc.invalidateQueries({ queryKey: ['projects'] });
}

export function invalidateProjectBoq(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'boq', 'vs-actual'] });
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'resources', 'utilization'] });
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'material-rate-variance'] });
}

export function invalidateProjectSchedule(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'gantt'] });
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
  invalidateProjectCore(qc, projectId);
}

export function invalidateProjectProcurement(qc: QueryClient, projectId: string) {
  invalidateProcurementLists(qc, projectId);
  invalidateProcurementStock(qc, projectId);
  qc.invalidateQueries({ queryKey: ['procurement', 'boq-shortfalls', projectId] });
  qc.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
}

/**
 * PROCUREMENT_PICKER_PERF: scoped invalidation. PO/GRN mutations only touch the
 * requisition list (and stock for GRN) - never the whole project BOQ.
 */

/** Requisition list only (indents + nested POs/GRNs). */
export function invalidateProcurementLists(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['procurement', 'requisitions', projectId] });
}

/** Stock locations, summary, and movements. */
export function invalidateProcurementStock(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['procurement', 'stock', projectId] });
  qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'summary', projectId] });
  qc.invalidateQueries({ queryKey: ['procurement', 'stock', 'movements', projectId] });
}

export function invalidateProjectSubcontract(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['subcontract', 'work-orders', projectId] });
  qc.invalidateQueries({ queryKey: ['subcontract', 'measurements', projectId] });
  qc.invalidateQueries({ queryKey: ['subcontract', 'summary', projectId] });
}

export function invalidateProjectAccounting(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['invoices', 'list', projectId] });
  qc.invalidateQueries({ queryKey: ['bills', 'list', projectId] });
  qc.invalidateQueries({ queryKey: ['bills', 'summary', projectId] });
}

export function invalidateBillPaymentImpact(qc: QueryClient, projectId: string) {
  invalidateProjectAccounting(qc, projectId);
  invalidateProjectSubcontract(qc, projectId);
  invalidateProjectCore(qc, projectId);
  invalidateAnalyticsDashboard(qc);
}

export function invalidateAnalyticsDashboard(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['analytics', 'dashboard'] });
}

/**
 * EST-VO-11e: Invalidate estimate variations query when change orders are
 * created/submitted/approved/rejected. estimateId is unknown at call site
 * (it's on the ChangeOrder), so we invalidate the prefix broadly - React
 * Query will refetch any active ['estimates', *, 'variations'] queries.
 */
export function invalidateEstimateVariations(qc: QueryClient) {
  qc.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'estimates' &&
      query.queryKey[2] === 'variations',
  });
}

/** Full side-effect bundle after variation approval. */
export function invalidateChangeOrderImpact(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['change-orders', projectId] });
  // R13-VO4: Invalidate impact + scope-summary queries so the UI refreshes.
  qc.invalidateQueries({ queryKey: ['change-order-impact', projectId] });
  qc.invalidateQueries({ queryKey: ['project-scope-summary', projectId] });
  // EST-VO-11e: Invalidate estimate variations so estimate detail refreshes.
  invalidateEstimateVariations(qc);
  invalidateProjectCore(qc, projectId);
  invalidateProjectBoq(qc, projectId);
  invalidateProjectSchedule(qc, projectId);
  invalidateProjectProcurement(qc, projectId);
  invalidateProjectSubcontract(qc, projectId);
  invalidateAnalyticsDashboard(qc);
}

/** Estimate convert → BOQ (+ auto-indents, budget). */
export function invalidateConvertToBoqImpact(qc: QueryClient, projectId: string) {
  invalidateProjectCore(qc, projectId);
  invalidateProjectBoq(qc, projectId);
  invalidateProjectProcurement(qc, projectId);
  invalidateAnalyticsDashboard(qc);
}
