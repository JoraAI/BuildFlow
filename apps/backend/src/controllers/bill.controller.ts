/**
 * BuildFlow - Bill controller (thin handlers).
 */
import type { Request, Response } from 'express';
import * as billService from '../services/bill.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';
import { ApiError } from '../utils/errors';

/** Project-scoped routes use :id; company-wide list may use ?projectId= */
function resolveProjectId(req: Request): string | undefined {
  return (req.params.id as string | undefined) ?? (req.query.projectId as string | undefined);
}

export async function list(req: Request, res: Response) {
  const data = await billService.listBills(
    req.user!.companyId,
    resolveProjectId(req),
    req.query.status as string | undefined,
  );
  return ok(res, data);
}

export async function get(req: Request, res: Response) {
  const data = await billService.getBill(req.user!.companyId, req.params.id);
  return ok(res, data);
}

export async function create(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const projectId = (req.body.projectId as string | undefined) ?? (req.params.id as string | undefined);
  const data = await billService.createBill(companyId, userId, { ...req.body, projectId });
  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'Bill',
    entityId: data.id,
    newValue: { billNumber: data.billNumber, total: data.total },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function update(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await billService.updateBill(companyId, req.params.id, req.body);
  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'Bill',
    entityId: data.id,
    newValue: { billNumber: data.billNumber, total: data.total },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function approve(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await billService.approveBill(companyId, userId, req.params.id);
  await recordAudit({
    companyId,
    userId,
    action: 'APPROVE',
    entityType: 'Bill',
    entityId: data.id,
    newValue: { status: data.status },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function reject(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await billService.rejectBill(companyId, userId, req.params.id);
  await recordAudit({
    companyId,
    userId,
    action: 'REJECT',
    entityType: 'Bill',
    entityId: data.id,
    newValue: { status: data.status },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function pay(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await billService.payBill(companyId, userId, req.params.id);
  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'Bill',
    entityId: data.id,
    newValue: { status: data.status, paidAmount: data.paidAmount },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function recordPayment(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await billService.recordBillPayment(companyId, userId, req.params.id, req.body);
  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'Bill',
    entityId: data.id,
    newValue: { status: data.status, paidAmount: data.paidAmount },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function remove(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  if (req.user!.role === 'SUPERVISOR') {
    throw ApiError.forbidden('Supervisors cannot delete bills');
  }
  const data = await billService.deleteBill(companyId, req.params.id);
  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'Bill',
    entityId: data.id,
    ipAddress: req.ip,
  });
  return ok(res, { id: data.id });
}

export async function summary(req: Request, res: Response) {
  const data = await billService.getBillSummary(req.user!.companyId, resolveProjectId(req));
  return ok(res, data);
}