import { Router } from 'express';
import * as ctrl from '../controllers/inventory-traceability.controller';
import { authenticateToken } from '../middleware/auth';
export const inventoryTraceabilityRouter = Router();
inventoryTraceabilityRouter.use(authenticateToken);
inventoryTraceabilityRouter.get('/:projectId/inventory/:resourceId/trace', ctrl.trace);
