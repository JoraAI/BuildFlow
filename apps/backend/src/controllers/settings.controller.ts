/**
 * BuildFlow — Settings controller.
 */
import { Request, Response } from 'express';
import { ok, okList } from '../utils/response';
import * as settingsService from '../services/settings.service';
import { streamCompanyZip } from '../services/export-zip.service';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Company Profile
// ---------------------------------------------------------------------------
export async function getCompany(req: Request, res: Response) {
  const company = await settingsService.getCompanyProfile(req.user!.companyId);
  return ok(res, company);
}

export async function updateCompany(req: Request, res: Response) {
  const company = await settingsService.updateCompanyProfile(req.user!.companyId, req.body);
  res.locals.audit = { entityId: company.id, newValue: company };
  return ok(res, company);
}

// ---------------------------------------------------------------------------
// Users & Roles
// ---------------------------------------------------------------------------
export async function listCompanyUsers(req: Request, res: Response) {
  const users = await settingsService.listUsers(req.user!.companyId);
  return ok(res, users);
}

export async function updateUserRole(req: Request, res: Response) {
  const user = await settingsService.updateUser(
    req.params.userId,
    req.user!.companyId,
    req.body,
  );
  res.locals.audit = { entityId: user.id, newValue: user };
  return ok(res, user);
}

export async function getUserAudit(req: Request, res: Response) {
  const stats = await settingsService.getUserAuditStats(
    req.params.userId,
    req.user!.companyId,
  );
  return ok(res, stats);
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------
export async function listAudit(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const entityType = req.query.entityType ? String(req.query.entityType) : undefined;

  const { rows, total } = await settingsService.listAuditLogs(req.user!.companyId, {
    page,
    limit,
    userId,
    entityType,
  });

  return okList(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

// ---------------------------------------------------------------------------
// Data Export
// ---------------------------------------------------------------------------
export async function getIntegrations(_req: Request, res: Response) {
  const status = {
    tally: !!process.env.TALLY_LEDGER_MAP,
    twilio:
      !!process.env.TWILIO_ACCOUNT_SID &&
      !!process.env.TWILIO_AUTH_TOKEN &&
      !!process.env.TWILIO_WHATSAPP_FROM,
    maps: !!env.GOOGLE_MAPS_API_KEY,
    razorpay:
      !!process.env.RAZORPAY_KEY_ID &&
      !!process.env.RAZORPAY_KEY_SECRET &&
      !!process.env.RAZORPAY_WEBHOOK_SECRET,
    stripe:
      !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET,
  };
  res.json({ success: true, data: status });
}

export async function exportData(req: Request, res: Response) {
  const snapshot = await settingsService.exportCompanyData(req.user!.companyId);
  return ok(res, snapshot);
}

export async function exportDataZip(req: Request, res: Response) {
  await streamCompanyZip(req.user!.companyId, res);
}
