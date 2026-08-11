/**
 * BuildFlow - Procurement picker eligibility helpers.
 *
 * Locked product rules (docs/PROCUREMENT_PICKER_PERF.md):
 *   - New PO → indent: status === 'APPROVED' AND zero POs on the indent.
 *   - New GRN → PO: status !== 'CANCELLED' AND NOT fully received.
 *
 * "Fully received" means every PO line's cumulative GRN qty (summed across all
 * goods receipts, per resource) reaches the PO line qty (±0.001 float epsilon).
 * Shared by both the inventory shell and the construction ProcurementTab so the
 * pickers behave identically everywhere.
 */

export interface ProcurementPoLike {
  status?: string | null;
  lines: Array<{ resourceId: string; quantity: number | string }>;
  goodsReceipts?: Array<{
    lines?: Array<{ resourceId: string; quantity: number | string }>;
  }>;
}

export interface ProcurementRequisitionLike {
  status?: string | null;
  purchaseOrders?: Array<unknown> | null;
}

/** True when every PO line qty is covered by cumulative GRN receipts. */
export function isPoFullyReceived(po: ProcurementPoLike): boolean {
  if (!po.lines?.length) return false;
  const received = new Map<string, number>();
  for (const g of po.goodsReceipts ?? []) {
    for (const l of g.lines ?? []) {
      received.set(l.resourceId, (received.get(l.resourceId) ?? 0) + Number(l.quantity));
    }
  }
  return po.lines.every((l) => (received.get(l.resourceId) ?? 0) >= Number(l.quantity) - 0.001);
}

/** Approved indents with zero POs are eligible for "New PO". */
export function indentAvailableForNewPo(req: ProcurementRequisitionLike): boolean {
  return req.status === 'APPROVED' && (req.purchaseOrders?.length ?? 0) === 0;
}

/** Non-cancelled POs that still have qty to receive are eligible for "New GRN". */
export function poAvailableForNewGrn(po: ProcurementPoLike): boolean {
  return po.status !== 'CANCELLED' && !isPoFullyReceived(po);
}

/**
 * Remaining receivable quantity per resourceId for a PO
 * (PO line qty minus cumulative GRN receipts, floored at 0).
 */
export function poRemainingByResource(po: ProcurementPoLike): Map<string, number> {
  const received = new Map<string, number>();
  for (const g of po.goodsReceipts ?? []) {
    for (const l of g.lines ?? []) {
      received.set(l.resourceId, (received.get(l.resourceId) ?? 0) + Number(l.quantity));
    }
  }
  const remaining = new Map<string, number>();
  for (const l of po.lines ?? []) {
    const qty = Number(l.quantity);
    const already = received.get(l.resourceId) ?? 0;
    remaining.set(l.resourceId, Math.max(0, qty - already));
  }
  return remaining;
}
