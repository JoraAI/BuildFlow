/**
 * BuildFlow - Change order controller (thin handlers).
 */
import type { Request, Response } from 'express';
import * as changeOrderService from '../services/change-order.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';

export async function list(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.listChangeOrders(companyId, userId, role, req.params.id);
  return ok(res, data);
}

export async function create(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.createChangeOrder(
    companyId,
    userId,
    role,
    req.params.id,
    req.body,
  );
  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'ChangeOrder',
    entityId: data.id,
    newValue: { number: data.number, costImpact: data.costImpact },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function submit(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.submitChangeOrder(
    companyId,
    userId,
    role,
    req.params.changeOrderId,
  );
  return ok(res, data);
}

export async function approve(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.approveChangeOrder(
    companyId,
    userId,
    role,
    req.params.changeOrderId,
    req.ip,
  );
  return ok(res, data);
}

// VAR-D2: Convert approved variation to BOQ
export async function convertToBoq(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const { id: _projectId, changeOrderId } = req.params;
  const result = await changeOrderService.convertChangeOrderToBoq(
    companyId,
    userId,
    role as string,
    changeOrderId,
    req.ip,
  );
  return ok(res, result);
}

export async function reject(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.rejectChangeOrder(
    companyId,
    userId,
    role,
    req.params.changeOrderId,
    req.body.reason,
  );
  return ok(res, data);
}

/**
 * List BOQ items eligible for a variation picker (not superseded, optional search).
 * Route: GET /api/projects/:id/change-orders/:changeOrderId/eligible-boq?search=
 */
export async function listEligibleBoq(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.listEligibleBoqItems(
    companyId,
    userId,
    role,
    req.params.id,
    typeof req.query.search === 'string' ? req.query.search : undefined,
  );
  return ok(res, data);
}

/**
 * Bulk-attach BOQ items as variation lines to a draft change order.
 * Route: POST /api/projects/:id/change-orders/:changeOrderId/add-boq-lines
 */
export async function addBoqLines(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.addBoqLinesToChangeOrder(
    companyId,
    userId,
    role,
    req.params.changeOrderId,
    req.body,
  );
  return ok(res, data);
}

/**
 * FIX (EST-H6): Update a change-order line's qtyDelta/rate and recompute costImpact.
 * Route: PUT /api/projects/:id/change-orders/:changeOrderId/lines/:lineId
 */
export async function updateLine(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await changeOrderService.updateChangeOrderLine(
    companyId,
    userId,
    role,
    req.params.changeOrderId,
    req.params.lineId,
    req.body,
  );
  return ok(res, data);
}

/**
 * VO-B1: Post-approve impact summary - BOQ changes + indents + budget delta.
 * Route: GET /api/projects/:id/change-orders/:changeOrderId/impact
 */
export async function impact(req: Request, res: Response) {
  const { companyId } = req.user!;
  const data = await changeOrderService.getChangeOrderImpact(companyId, req.params.changeOrderId);
  return ok(res, data);
}

/**
 * VO-B4: Revised scope summary - original estimate + approved variations.
 * Route: GET /api/projects/:id/scope-summary
 */
export async function scopeSummary(req: Request, res: Response) {
  const { companyId } = req.user!;
  const data = await changeOrderService.getProjectScopeSummary(companyId, req.params.id);
  return ok(res, data);
}
