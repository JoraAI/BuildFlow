/**
 * BuildFlow - Platform admin controller.
 */
import { Request, Response, NextFunction } from 'express';
import { ok } from '../utils/response';
import * as platformService from '../services/platform.service';
import * as ticketService from '../services/ticket.service';

export async function login(req: Request, res: Response) {
  const result = await platformService.platformLogin(req.body);
  return ok(res, result);
}

export async function me(req: Request, res: Response) {
  const admin = await platformService.platformMe(req.platformAdmin!.id);
  return ok(res, admin);
}

export async function listCompanies(req: Request, res: Response) {
  const q = req.query.q ? String(req.query.q) : undefined;
  const companies = await platformService.searchCompanies(q);
  return ok(res, companies);
}

export async function getCompany(req: Request, res: Response) {
  const company = await platformService.getCompanyDetail(req.params.companyId);
  return ok(res, company);
}

export async function patchCompany(req: Request, res: Response) {
  const company = await platformService.updateCompanyAsAdmin(
    req.platformAdmin!.id,
    req.params.companyId,
    req.body,
  );
  return ok(res, company);
}

export async function patchSubscription(req: Request, res: Response) {
  const company = await platformService.updateSubscriptionAsAdmin(
    req.platformAdmin!.id,
    req.params.companyId,
    req.body,
  );
  return ok(res, company);
}

export async function patchUser(req: Request, res: Response) {
  const user = await platformService.updateUserAsAdmin(
    req.platformAdmin!.id,
    req.params.companyId,
    req.params.userId,
    req.body,
  );
  return ok(res, user);
}

export async function listTickets(_req: Request, res: Response) {
  const tickets = await ticketService.listPlatformTickets();
  return ok(res, tickets);
}

export async function patchTicket(req: Request, res: Response) {
  const ticket = await ticketService.updatePlatformTicket(req.params.ticketId, req.body);
  return ok(res, ticket);
}

export async function deactivateCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.params;
    const { reason } = req.body as { reason?: string };
    const result = await platformService.deactivateCompany(
      req.platformAdmin!.id,
      companyId,
      reason ?? 'No reason provided',
    );
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}
