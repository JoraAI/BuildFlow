/**
 * BuildFlow — Daily Report controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as reportService from '../services/daily-report.service';
import { ok, created } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function listReports(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reportService.listReports(req.user!.companyId, req.params.id, {
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getReportCalendar(req: Request, res: Response, next: NextFunction) {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const result = await reportService.getReportCalendar(req.user!.companyId, req.params.id, month);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reportService.getReport(req.user!.companyId, req.params.id);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const idempotencyKey = req.get('Idempotency-Key') ?? undefined;
    const item = await reportService.createReport(
      companyId,
      userId,
      req.params.id,
      req.body,
      ipOf(req),
      idempotencyKey,
    );
    created(res, item);
  } catch (err) {
    next(err);
  }
}

export async function updateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const item = await reportService.updateReport(
      companyId,
      userId,
      req.params.id,
      req.body,
      ipOf(req),
    );
    ok(res, item);
  } catch (err) {
    next(err);
  }
}

export async function createPhotoUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await reportService.createPhotoUploadUrl(
      companyId,
      userId,
      req.params.id,
      req.body,
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function confirmPhotoUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await reportService.confirmPhotoUpload(
      companyId,
      userId,
      req.params.id,
      req.body.s3Keys,
      ipOf(req),
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function resolvePhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportService.getReport(req.user!.companyId, req.params.id);
    const urls = await reportService.resolvePhotoUrls(req.user!.companyId, report.photos ?? []);
    ok(res, { urls });
  } catch (err) {
    next(err);
  }
}