import { Router } from 'express';
import * as ctrl from '../controllers/sync.controller';
import { authenticateToken } from '../middleware/auth';

export const syncRouter = Router();
syncRouter.use(authenticateToken);
syncRouter.get('/delta', ctrl.delta);
syncRouter.get('/status', ctrl.status);
