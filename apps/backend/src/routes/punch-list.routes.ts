import { Router } from 'express';
import * as ctrl from '../controllers/punch-list.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPunchItemSchema, updatePunchItemSchema, punchItemIdParamsSchema, punchItemQuerySchema, Role } from '@buildflow/shared';
export const punchListRouter = Router();
punchListRouter.use(authenticateToken);
// Align with snag.create / snag.rectify defaults (DPM + mechanical can log; site can rectify).
const MUT = requireRole(
  Role.OWNER,
  Role.PM,
  Role.DPM,
  Role.SITE_SUPERVISOR,
  Role.SUPERVISOR,
  Role.QC,
  Role.MECHANICAL_MANAGER,
);
punchListRouter.get('/', validate({ query: punchItemQuerySchema }), ctrl.list);
punchListRouter.post('/', MUT, validate({ body: createPunchItemSchema.shape.body }), ctrl.create);
punchListRouter.get('/:id', validate({ params: punchItemIdParamsSchema }), ctrl.get);
punchListRouter.put('/:id', MUT, validate({ params: punchItemIdParamsSchema, body: updatePunchItemSchema.shape.body }), ctrl.update);
punchListRouter.delete('/:id', MUT, validate({ params: punchItemIdParamsSchema }), ctrl.remove);
