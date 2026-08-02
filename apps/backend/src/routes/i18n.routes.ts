import { Router } from 'express';
import * as ctrl from '../controllers/i18n.controller';
export const i18nRouter = Router();
i18nRouter.get('/', ctrl.get);
