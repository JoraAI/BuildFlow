import { Router } from 'express';
import * as ctrl from '../controllers/portal-enhanced.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Role } from '@buildflow/shared';
export const portalEnhancedRouter = Router();
portalEnhancedRouter.use(authenticateToken);
portalEnhancedRouter.get('/:id/portal-access', ctrl.list);
portalEnhancedRouter.delete('/:id/portal-access/:accessId', requireRole(Role.OWNER, Role.PM), ctrl.revoke);
