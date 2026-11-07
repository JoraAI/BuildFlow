import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  auditorManualEntrySchema,
  createGstHandoffPackSchema,
  updateGstHandoffPackStatusSchema,
} from '@buildflow/shared';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import * as ctrl from '../controllers/auditor.controller';

export const auditorRouter = Router();
auditorRouter.use(authenticateToken);

// Role gate (not only permission) so shops with older customized
// INVENTORY_MANAGER permission rows still send packs without a matrix migration.
auditorRouter.get(
  '/packs',
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.listOwnerPacks,
);
auditorRouter.post(
  '/packs',
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: createGstHandoffPackSchema }),
  ctrl.createPack,
);
auditorRouter.get(
  '/packs/:packId',
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.ownerPackDetail,
);
auditorRouter.post(
  '/packs/:packId/send',
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.sendPack,
);
auditorRouter.delete(
  '/packs/:packId',
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  ctrl.deletePack,
);
auditorRouter.post(
  '/auditors/:userId/revoke',
  requireRole(Role.OWNER),
  requirePermission('settings.users'),
  ctrl.revokeAuditor,
);

auditorRouter.get(
  '/inbox',
  requirePermission('auditor.view_packs'),
  ctrl.auditorInbox,
);
auditorRouter.get(
  '/inbox/:packId',
  requirePermission('auditor.view_packs'),
  ctrl.auditorPackDetail,
);
auditorRouter.patch(
  '/inbox/:packId/status',
  requirePermission('auditor.file_pack'),
  validate({ body: updateGstHandoffPackStatusSchema }),
  ctrl.updatePackStatus,
);
auditorRouter.post(
  '/inbox/:packId/manual-entries',
  requirePermission('auditor.manual_entry'),
  validate({ body: auditorManualEntrySchema }),
  ctrl.addManualEntry,
);
