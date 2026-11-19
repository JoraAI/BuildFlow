/**
 * Shop unit catalog routes — /api/inventory/units
 */
import { Router } from 'express';
import * as ctrl from '../controllers/company-unit.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import {
  Role,
  companyUnitCreateSchema,
  companyUnitUpdateSchema,
  companyUnitIdParamsSchema,
} from '@buildflow/shared';

export const companyUnitRouter = Router();

companyUnitRouter.use(authenticateToken);
companyUnitRouter.use(requireInventoryFeature('parties'));

const canManage = requireRole(Role.OWNER, Role.INVENTORY_MANAGER);

companyUnitRouter.get('/', ctrl.list);
companyUnitRouter.post('/', canManage, validate({ body: companyUnitCreateSchema }), ctrl.create);
companyUnitRouter.patch(
  '/:id',
  canManage,
  validate({ params: companyUnitIdParamsSchema, body: companyUnitUpdateSchema }),
  ctrl.update,
);
companyUnitRouter.delete(
  '/:id',
  canManage,
  validate({ params: companyUnitIdParamsSchema }),
  ctrl.deactivate,
);
