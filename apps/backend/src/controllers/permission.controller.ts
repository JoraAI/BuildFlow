/**
 * BuildFlow - Settings permission controller (thin).
 */
import { Request, Response } from 'express';
import { ok } from '../utils/response';
import { ApiError } from '../utils/errors';
import * as permService from '../services/permission.service';
import type { Role, Permission } from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* GET /api/settings/permissions — full permission state               */
/* ------------------------------------------------------------------ */

export async function getPermissions(req: Request, res: Response) {
  const data = await permService.getPermissionState(req.user!.companyId);
  ok(res, data);
}

/* ------------------------------------------------------------------ */
/* PUT /api/settings/permissions/:role — update role permissions       */
/* ------------------------------------------------------------------ */

export async function updateRolePermissions(req: Request, res: Response) {
  const role = req.params.role as Role;

  // Only non-OWNER roles can be customized
  if (role === 'OWNER') {
    throw ApiError.badRequest('OWNER permissions cannot be modified');
  }

  const { permissions } = req.body as { permissions: Permission[] };
  if (!Array.isArray(permissions)) {
    throw ApiError.badRequest('permissions must be an array');
  }

  const data = await permService.updatePermissions(
    req.user!.companyId,
    req.user!.id,
    role,
    permissions,
    req.ip,
  );
  ok(res, data);
}

/* ------------------------------------------------------------------ */
/* POST /api/settings/permissions/:role/reset — reset to default       */
/* ------------------------------------------------------------------ */

export async function resetRolePermissions(req: Request, res: Response) {
  const role = req.params.role as Role;

  if (role === 'OWNER') {
    throw ApiError.badRequest('OWNER permissions cannot be reset');
  }

  const data = await permService.resetPermissions(
    req.user!.companyId,
    req.user!.id,
    role,
    req.ip,
  );
  ok(res, data);
}

/* ------------------------------------------------------------------ */
/* POST /api/settings/permissions/reset — reset ALL to defaults        */
/* ------------------------------------------------------------------ */

export async function resetAllRolePermissions(req: Request, res: Response) {
  const data = await permService.resetAllPermissions(
    req.user!.companyId,
    req.user!.id,
    req.ip,
  );
  ok(res, data);
}