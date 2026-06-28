/**
 * BuildFlow — Change order controller (thin handlers).
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
