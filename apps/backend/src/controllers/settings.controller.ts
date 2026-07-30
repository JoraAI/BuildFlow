/**
 * BuildFlow - Settings controller.
 */
import { Request, Response } from 'express';
import { ok, okList } from '../utils/response';
import { ApiError } from '../utils/errors';
import * as settingsService from '../services/settings.service';
import * as inviteService from '../services/invite.service';
import { streamCompanyZip } from '../services/export-zip.service';
import { getSubscriptionSummary } from '../services/subscription.service';
import * as ticketService from '../services/ticket.service';
import * as integrationService from '../services/integration.service';
import {
  createSaasCheckout,
  getSaasBillingAvailability,
} from '../services/saas-billing.service';

// ---------------------------------------------------------------------------
// My Profile
// ---------------------------------------------------------------------------
export async function getMyProfile(req: Request, res: Response) {
  const profile = await settingsService.getMyProfile(req.user!.id, req.user!.companyId);
  return ok(res, profile);
}

export async function updateMyProfile(req: Request, res: Response) {
  const profile = await settingsService.updateMyProfile(
    req.user!.id,
    req.user!.companyId,
    req.body,
  );
  res.locals.audit = { entityId: req.user!.id, newValue: profile };
  return ok(res, profile);
}

export async function createLogoUploadUrl(req: Request, res: Response) {
  const result = await settingsService.createCompanyLogoUploadUrl(
    req.user!.companyId,
    req.body,
  );
  return ok(res, result);
}

// ---------------------------------------------------------------------------
// Support Tickets
// ---------------------------------------------------------------------------
export async function createTicket(req: Request, res: Response) {
  const ticket = await ticketService.createTicket(
    req.user!.companyId,
    req.user!.id,
    req.body,
  );
  return ok(res, ticket, 201);
}

export async function listMyTickets(req: Request, res: Response) {
  const tickets = await ticketService.listMyTickets(req.user!.companyId, req.user!.id);
  return ok(res, tickets);
}

export async function listTicketInbox(req: Request, res: Response) {
  const tickets = await ticketService.listCompanyInbox(req.user!.companyId);
  return ok(res, tickets);
}

export async function updateTicket(req: Request, res: Response) {
  const ticket = await ticketService.updateCompanyTicket(
    req.params.ticketId,
    req.user!.companyId,
    req.user!.id,
    req.body,
  );
  return ok(res, ticket);
}

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
    req.user!.id, // FIX (SEC-H8): pass caller id for self-role-change guard
  );
  res.locals.audit = { entityId: user.id, newValue: user };
  return ok(res, user);
}

export async function createUserInvite(req: Request, res: Response) {
  const result = await inviteService.createInvite(
    req.user!.companyId,
    req.user!.id,
    req.body,
  );
  return ok(res, result, 201);
}

export async function listUserInvites(req: Request, res: Response) {
  const invites = await inviteService.listPendingInvites(req.user!.companyId);
  return ok(res, invites);
}

export async function revokeUserInvite(req: Request, res: Response) {
  await inviteService.revokeInvite(req.user!.companyId, req.params.inviteId, req.user!.id);
  return ok(res, { success: true });
}

export async function resendUserInvite(req: Request, res: Response) {
  const result = await inviteService.resendInvite(
    req.user!.companyId,
    req.params.inviteId,
    req.user!.id,
  );
  return ok(res, result);
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
export async function getIntegrations(req: Request, res: Response) {
  const overview = await integrationService.getIntegrationsOverview(req.user!.companyId);
  return ok(res, overview);
}

export async function updateTwilioIntegration(req: Request, res: Response) {
  const result = await integrationService.upsertIntegration(
    req.user!.companyId,
    req.user!.id,
    'TWILIO',
    req.body,
  );
  res.locals.audit = { entityId: req.user!.companyId, newValue: { provider: 'TWILIO' } };
  return ok(res, result);
}

export async function updateRazorpayIntegration(req: Request, res: Response) {
  const result = await integrationService.upsertIntegration(
    req.user!.companyId,
    req.user!.id,
    'RAZORPAY',
    req.body,
  );
  res.locals.audit = { entityId: req.user!.companyId, newValue: { provider: 'RAZORPAY' } };
  return ok(res, result);
}

export async function updateStripeIntegration(req: Request, res: Response) {
  const result = await integrationService.upsertIntegration(
    req.user!.companyId,
    req.user!.id,
    'STRIPE',
    req.body,
  );
  res.locals.audit = { entityId: req.user!.companyId, newValue: { provider: 'STRIPE' } };
  return ok(res, result);
}

export async function updateTallyIntegration(req: Request, res: Response) {
  const result = await integrationService.upsertIntegration(
    req.user!.companyId,
    req.user!.id,
    'TALLY',
    req.body,
  );
  res.locals.audit = { entityId: req.user!.companyId, newValue: { provider: 'TALLY' } };
  return ok(res, result);
}

export async function updateGoogleMapsIntegration(req: Request, res: Response) {
  const result = await integrationService.upsertIntegration(
    req.user!.companyId,
    req.user!.id,
    'GOOGLE_MAPS',
    req.body,
  );
  res.locals.audit = { entityId: req.user!.companyId, newValue: { provider: 'GOOGLE_MAPS' } };
  return ok(res, result);
}

export async function updateLlmIntegration(req: Request, res: Response) {
  const result = await integrationService.upsertIntegration(
    req.user!.companyId,
    req.user!.id,
    'LLM',
    req.body,
  );
  res.locals.audit = { entityId: req.user!.companyId, newValue: { provider: 'LLM' } };
  return ok(res, result);
}

export async function updateS3Integration(req: Request, res: Response) {
  const result = await integrationService.upsertIntegration(
    req.user!.companyId,
    req.user!.id,
    'S3',
    req.body,
  );
  res.locals.audit = { entityId: req.user!.companyId, newValue: { provider: 'S3' } };
  return ok(res, result);
}

export async function getSubscription(req: Request, res: Response) {
  const summary = await getSubscriptionSummary(req.user!.companyId);
  const billing = getSaasBillingAvailability();
  return ok(res, { ...summary, billing });
}

export async function createSubscriptionCheckout(req: Request, res: Response) {
  try {
    const result = await createSaasCheckout(
      req.user!.companyId,
      req.body.plan,
      req.body.gateway ?? 'razorpay',
    );
    return ok(res, result);
  } catch (err) {
    if (err instanceof Error && err.message.includes('NOT_CONFIGURED')) {
      throw ApiError.badRequest('Online checkout is not available yet. Submit a billing request.');
    }
    throw err;
  }
}

export async function exportData(req: Request, res: Response) {
  const snapshot = await settingsService.exportCompanyData(req.user!.companyId);
  return ok(res, snapshot);
}

export async function exportDataZip(req: Request, res: Response) {
  await streamCompanyZip(req.user!.companyId, res);
}
