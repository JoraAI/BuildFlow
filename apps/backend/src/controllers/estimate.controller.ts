/**
 * BuildFlow - Estimate controller (thin).
 */
import { Request, Response } from 'express';
import * as svc from '../services/estimate.service';
import * as exportSvc from '../services/estimate-export.service';
import { ok, created } from '../utils/response';

/* ------------------------------------------------------------------ */
/* Estimate-level                                                     */
/* ------------------------------------------------------------------ */

export async function list(req: Request, res: Response) {
  const data = await svc.listEstimates(req.user!.companyId, req.params.projectId);
  ok(res, data);
}

export async function get(req: Request, res: Response) {
  const data = await svc.getEstimateWithSummary(req.user!.companyId, req.params.id);
  ok(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await svc.createEstimate(
    req.user!.companyId,
    req.user!.id,
    req.params.projectId,
    req.body,
    req.ip,
  );
  created(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await svc.updateEstimateMeta(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.body,
    req.ip,
  );
  ok(res, data);
}

export async function remove(req: Request, res: Response) {
  await svc.deleteEstimate(req.user!.companyId, req.user!.id, req.params.id, req.ip);
  ok(res, { id: req.params.id });
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export async function createSection(req: Request, res: Response) {
  const data = await svc.createSection(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.body,
    req.ip,
  );
  created(res, data);
}

export async function updateSection(req: Request, res: Response) {
  const data = await svc.updateSection(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.params.sid,
    req.body,
    req.ip,
  );
  ok(res, data);
}

export async function deleteSection(req: Request, res: Response) {
  await svc.deleteSection(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.params.sid,
    req.ip,
  );
  ok(res, { id: req.params.sid });
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export async function createItem(req: Request, res: Response) {
  const data = await svc.createItem(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.body,
    req.ip,
  );
  created(res, data);
}

export async function updateItem(req: Request, res: Response) {
  const data = await svc.updateItem(
    req.user!.companyId,
    req.user!.id,
    req.params.itemId,
    req.body,
    req.ip,
  );
  ok(res, data);
}

export async function deleteItem(req: Request, res: Response) {
  await svc.deleteItem(req.user!.companyId, req.user!.id, req.params.itemId, req.ip);
  ok(res, { id: req.params.itemId });
}

/* ------------------------------------------------------------------ */
/* Sub-items (children of a parent estimate item)                      */
/* ------------------------------------------------------------------ */

export async function listSubItems(req: Request, res: Response) {
  const data = await svc.listSubItems(req.user!.companyId, req.params.itemId);
  ok(res, data);
}

export async function createSubItem(req: Request, res: Response) {
  const data = await svc.createSubItem(
    req.user!.companyId,
    req.user!.id,
    req.params.itemId,
    req.body,
    req.ip,
  );
  created(res, data);
}

export async function deleteSubItem(req: Request, res: Response) {
  await svc.deleteSubItem(req.user!.companyId, req.user!.id, req.params.subItemId, req.ip);
  ok(res, { id: req.params.subItemId });
}

/* ------------------------------------------------------------------ */
/* Workflow                                                            */
/* ------------------------------------------------------------------ */

export async function submit(req: Request, res: Response) {
  const data = await svc.submitForReview(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.ip,
  );
  ok(res, data);
}

export async function approve(req: Request, res: Response) {
  const data = await svc.approveEstimate(
    req.user!.companyId,
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.ip,
  );
  ok(res, data);
}

export async function reject(req: Request, res: Response) {
  const data = await svc.rejectEstimate(
    req.user!.companyId,
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.body,
    req.ip,
  );
  ok(res, data);
}

export async function duplicate(req: Request, res: Response) {
  const data = await svc.duplicateEstimate(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.ip,
  );
  created(res, data);
}

export async function listSubEstimates(req: Request, res: Response) {
  const data = await svc.listSubEstimates(req.user!.companyId, req.params.id);
  ok(res, data);
}

export async function createSubEstimate(req: Request, res: Response) {
  const data = await svc.createSubEstimate(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.body,
    req.ip,
  );
  created(res, data);
}

export async function compare(req: Request, res: Response) {
  const data = await svc.compareEstimates(
    req.user!.companyId,
    req.params.id,
    req.params.id2,
  );
  ok(res, data);
}

/* ------------------------------------------------------------------ */
/* Exports (Excel + PDF)                                               */
/* ------------------------------------------------------------------ */

export async function exportExcel(req: Request, res: Response) {
  const buffer = await exportSvc.generateEstimateExcel(req.user!.companyId, req.params.id);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="estimate-${req.params.id}.xlsx"`,
  );
  res.send(buffer);
}

export async function exportPdf(req: Request, res: Response) {
  const buffer = await exportSvc.generateEstimatePdf(req.user!.companyId, req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="estimate-${req.params.id}.pdf"`);
  res.send(buffer);
}
