/**
 * BuildFlow - Invoice controller (thin handlers).
 */
import type { NextFunction, Request, Response } from 'express';
import * as invoiceService from '../services/invoice.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';
import { ApiError } from '../utils/errors';

/** Project-scoped routes use :id; company-wide list may use ?projectId= */
function resolveProjectId(req: Request): string | undefined {
  return (req.params.id as string | undefined) ?? (req.query.projectId as string | undefined);
}

export async function list(req: Request, res: Response) {
  const companyId = req.user!.companyId;
  const projectId = resolveProjectId(req);
  const status = req.query.status as string | undefined;
  const data = await invoiceService.listInvoices(companyId, projectId, status);
  return ok(res, data);
}

export async function get(req: Request, res: Response) {
  const data = await invoiceService.getInvoice(req.user!.companyId, req.params.id);
  return ok(res, data);
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const projectId = (req.body.projectId as string | undefined) ?? (req.params.id as string | undefined);
    const data = await invoiceService.createInvoice(companyId, userId, { ...req.body, projectId });
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: data.id,
      newValue: { invoiceNumber: data.invoiceNumber, total: data.total },
      ipAddress: req.ip,
    });
    // FIX: createInvoice can now throw (e.g. Phase 2.5 credit-limit BLOCK) - the
    // invoice routes don't use asyncHandler, so route errors through next().
    return created(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function update(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await invoiceService.updateInvoice(companyId, req.params.id, req.body);
  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: data.id,
    newValue: { invoiceNumber: data.invoiceNumber, total: data.total },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function send(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await invoiceService.sendInvoice(companyId, req.params.id);
  await recordAudit({
    companyId,
    userId,
    action: 'SEND',
    entityType: 'Invoice',
    entityId: data.id,
    newValue: { status: data.status },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function recordPayment(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await invoiceService.recordPayment(companyId, userId, req.params.id, req.body);
  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'Invoice',
    entityId: data.id,
    newValue: { status: data.status, paidAmount: data.paidAmount },
    ipAddress: req.ip,
  });
  return ok(res, data);
}

export async function remove(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  // Only ACCOUNTANT, PM, OWNER can delete drafts
  if (req.user!.role === 'SUPERVISOR') {
    throw ApiError.forbidden('Supervisors cannot delete invoices');
  }
  const data = await invoiceService.deleteInvoice(companyId, req.params.id);
  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'Invoice',
    entityId: data.id,
    ipAddress: req.ip,
  });
  return ok(res, { id: data.id });
}