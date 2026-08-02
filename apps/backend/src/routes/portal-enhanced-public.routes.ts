import { Router } from 'express';
import * as ctrl from '../controllers/portal-enhanced.controller';
export const portalEnhancedPublicRouter = Router();
portalEnhancedPublicRouter.get('/:token/enhanced', ctrl.enhancedData);
