/**
 * BuildFlow - Subcontract controller (thin handlers).
 */
import type { Request, Response } from 'express';
import * as subcontractService from '../services/subcontract.service';
import * as subPortalService from '../services/subcontract-portal.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';

// Subcontractors (company-scoped)
export async function listSubcontractors(req: Request, res: Response) {
  const data = await subcontractService.listSubcontractors(req.user!.companyId);
  return ok(res, data);
}

export async function getSubcontractor(req: Request, res: Response) {
  const data = await subcontractService.getSubcontractor(req.user!.companyId, req.params.subcontractorId);
  return ok(res, data);
}

export async function createSubcontractor(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const data = await subcontractService.createSubcontractor(companyId, req.body);
  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'Subcontractor',
    entityId: data.id,
    newValue: { name: data.name },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function updateSubcontractor(req: Request, res: Response) {
  const { companyId } = req.user!;
  const data = await subcontractService.updateSubcontractor(
    companyId,
    req.params.subcontractorId,
    req.body,
  );
  return ok(res, data);
}

export async function deleteSubcontractor(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  await subcontractService.deleteSubcontractor(companyId, req.params.subcontractorId);
  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'Subcontractor',
    entityId: req.params.subcontractorId,
    ipAddress: req.ip,
  });
  return ok(res, { id: req.params.subcontractorId });
}

// Work orders (project-scoped)
export async function listWorkOrders(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.listWorkOrders(companyId, userId, role, req.params.id);
  return ok(res, data);
}

export async function getWorkOrderSummary(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.getWorkOrderSummary(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.workOrderId,
  );
  return ok(res, data);
}

export async function getWorkOrder(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.getWorkOrder(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.workOrderId,
  );
  return ok(res, data);
}

export async function createWorkOrder(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.createWorkOrder(
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
    entityType: 'SubcontractWorkOrder',
    entityId: data.id,
    newValue: { woNumber: data.woNumber },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function createWorkOrderFromBoq(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.createWorkOrderFromBoq(
    companyId,
    userId,
    role,
    req.params.id,
    req.body,
  );
  return created(res, data);
}

export async function updateWorkOrder(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.updateWorkOrder(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.workOrderId,
    req.body,
  );
  return ok(res, data);
}

export async function deleteWorkOrder(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  await subcontractService.deleteWorkOrder(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.workOrderId,
  );
  return ok(res, { id: req.params.workOrderId });
}

// Measurements
export async function listMeasurements(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.listMeasurements(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.workOrderId,
  );
  return ok(res, data);
}

export async function getMeasurement(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.getMeasurement(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.measurementId,
  );
  return ok(res, data);
}

export async function createMeasurement(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.createMeasurement(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.workOrderId,
    req.body,
  );
  return created(res, data);
}

export async function updateMeasurement(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.updateMeasurement(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.measurementId,
    req.body,
  );
  return ok(res, data);
}

export async function deleteMeasurement(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  await subcontractService.deleteMeasurement(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.measurementId,
  );
  return ok(res, { id: req.params.measurementId });
}

export async function submitMeasurement(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.submitMeasurement(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.measurementId,
  );
  return ok(res, data);
}

export async function approveMeasurement(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.approveMeasurement(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.measurementId,
    req.body,
    req.ip,
  );
  return ok(res, data);
}

export async function rejectMeasurement(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.rejectMeasurement(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.measurementId,
    req.body.reason,
  );
  return ok(res, data);
}

export async function recordBillPayment(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subcontractService.recordSubcontractBillPayment(
    companyId,
    userId,
    role,
    req.params.id,
    req.params.billId,
    req.body.amount,
  );
  return ok(res, data);
}

export async function createSubcontractorPortalAccess(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await subPortalService.createSubcontractorPortalAccess(
    companyId,
    userId,
    role,
    req.params.id,
    req.body,
  );
  return created(res, data);
}
