/**
 * BuildFlow — Client portal controller (thin handlers).
 */
import type { Request, Response } from 'express';
import * as portalService from '../services/portal.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';

export async function createAccess(req: Request, res: Response) {
  const { companyId, id: userId, role } = req.user!;
  const data = await portalService.createPortalAccess(
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
    entityType: 'ClientPortalAccess',
    entityId: data.id,
    newValue: { label: data.label, scopes: data.scopes },
    ipAddress: req.ip,
  });
  return created(res, data);
}

export async function getByToken(req: Request, res: Response) {
  const data = await portalService.getPortalProjectData(req.params.token);
  return ok(res, data);
}
