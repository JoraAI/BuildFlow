/**
 * BuildFlow — Resource routes.
 */
import { Router } from 'express';
import * as resourceController from '../controllers/resource.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createResourceSchema,
  updateResourceSchema,
  resourceQuerySchema,
  resourceIdParamsSchema,
  createPriceHistorySchema,
  importResourcesSchema,
} from '@buildflow/shared';

export const resourceRouter = Router();

resourceRouter.use(authenticateToken);

resourceRouter.get('/', validate({ query: resourceQuerySchema }), resourceController.listResources);
resourceRouter.post('/', validate({ body: createResourceSchema }), resourceController.createResource);
resourceRouter.post('/import', validate({ body: importResourcesSchema }), resourceController.importResources);

resourceRouter.get('/:id', validate({ params: resourceIdParamsSchema }), resourceController.getResource);
resourceRouter.put('/:id', validate({ params: resourceIdParamsSchema, body: updateResourceSchema }), resourceController.updateResource);
resourceRouter.delete('/:id', validate({ params: resourceIdParamsSchema }), resourceController.deleteResource);

// Price history
resourceRouter.get('/:id/price-history', validate({ params: resourceIdParamsSchema }), resourceController.getPriceHistory);
resourceRouter.post('/:id/price-history', validate({ params: resourceIdParamsSchema, body: createPriceHistorySchema }), resourceController.addPriceHistory);