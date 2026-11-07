import type { NextFunction, Request, Response } from 'express';
import * as svc from '../services/auditor.service';
import { ok } from '../utils/response';

export async function listOwnerPacks(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.listOwnerPacks(req.user!.companyId));
  } catch (err) {
    next(err);
  }
}

export async function createPack(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.createGstHandoffPack(req.user!.companyId, req.user!.id, req.body), 201);
  } catch (err) {
    next(err);
  }
}

export async function sendPack(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.sendGstHandoffPack(req.user!.companyId, req.params.packId, req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function ownerPackDetail(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.getGstHandoffPackDetail(req.user!.companyId, req.params.packId, {}));
  } catch (err) {
    next(err);
  }
}

export async function auditorInbox(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.listAuditorInbox(req.user!.id, req.user!.companyId));
  } catch (err) {
    next(err);
  }
}

export async function auditorPackDetail(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await svc.getGstHandoffPackDetail(req.user!.companyId, req.params.packId, {
        auditorUserId: req.user!.id,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function updatePackStatus(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await svc.updatePackStatus(req.user!.companyId, req.params.packId, req.user!.id, req.body),
    );
  } catch (err) {
    next(err);
  }
}

export async function addManualEntry(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await svc.addManualEntry(req.user!.companyId, req.params.packId, req.user!.id, req.body),
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function revokeAuditor(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.revokeAuditorMembership(req.user!.companyId, req.params.userId, req.user!.id);
    ok(res, { revoked: true });
  } catch (err) {
    next(err);
  }
}
