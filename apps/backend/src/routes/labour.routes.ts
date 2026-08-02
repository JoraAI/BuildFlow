import { Router } from 'express';
import * as ctrl from '../controllers/labour.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Role } from '@buildflow/shared';
export const labourRouter = Router();
labourRouter.use(authenticateToken);
labourRouter.get('/:projectId/labour/attendance-summary', ctrl.attendanceSummary);
labourRouter.get('/:projectId/labour/cost-tracking', requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT), ctrl.labourCost);
labourRouter.get('/:projectId/labour/productivity', ctrl.productivity);
