/**
 * BuildFlow - Procurement controller (thin handlers).
 */
import type { Request, Response } from 'express';
import * as procurementService from '../services/procurement.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';

export async function listRequisitions(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.listRequisitions(companyId, userId, role, req.params.id);
  return ok(res, data);
}

export async function createRequisition(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.createRequisition(
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
    entityType: 'MaterialRequisition',
    entityId: data.id,
    newValue: { reqNumber: data.reqNumber },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function deleteRequisition(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.deleteRequisition(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.requisitionId,
  );
  return ok(res, data);
}

export async function submitRequisition(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.submitRequisition(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.requisitionId,
  );
  return ok(res, data);
}

export async function approveRequisition(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.approveRequisition(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.requisitionId,
  );
  return ok(res, data);
}

export async function createPO(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.createPO(companyId, userId, role, req.params.id, req.body);
  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'PurchaseOrder',
    entityId: data.id,
    newValue: { poNumber: data.poNumber, totalAmount: data.totalAmount },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function createGRN(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.createGRN(companyId, userId, role, req.params.id, req.body);
  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'GoodsReceiptNote',
    entityId: data.id,
    newValue: { grnNumber: data.grnNumber },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function listStock(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.listStock(companyId, userId, role, req.params.id);
  return ok(res, data);
}

export async function getStockSummary(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.getStockSummary(companyId, userId, role, req.params.id);
  return ok(res, data);
}

export async function listStockMovements(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const resourceId = typeof req.query.resourceId === 'string' ? req.query.resourceId : undefined;
  const limit =
    typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
  const data = await procurementService.listStockMovements(companyId, userId, role, req.params.id, {
    resourceId,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return ok(res, data);
}

export async function getBoqShortfalls(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.getBoqShortfalls(companyId, userId, role, req.params.id);
  return ok(res, data);
}

export async function generateIndentsFromBoq(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await procurementService.generateIndentsFromBoq(
    companyId,
    userId,
    role,
    req.params.id,
  );
  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'MaterialRequisition',
    entityId: req.params.id,
    newValue: { source: 'BOQ_UPDATE', created: data.created, reqNumbers: data.reqNumbers },
    ipAddress: req.ip,
  });
  return created(res, data);
}
