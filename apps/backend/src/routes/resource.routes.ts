/**
 * BuildFlow - Resource routes.
 */
import { Router } from 'express';
import * as resourceController from '../controllers/resource.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createResourceSchema,
  updateResourceSchema,
  resourceQuerySchema,
  resourceIdParamsSchema,
  createPriceHistorySchema,
  importResourcesSchema,
  bulkUpsertResourcesSchema,
  bulkPriceUpdateSchema,
  resourceImageUploadSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

export const resourceRouter = Router();

const canManageResources = requireRole(Role.OWNER, Role.PM, Role.INVENTORY_MANAGER);

resourceRouter.use(authenticateToken);

resourceRouter.get('/', validate({ query: resourceQuerySchema }), resourceController.listResources);
resourceRouter.post('/', canManageResources, validate({ body: createResourceSchema }), resourceController.createResource);
resourceRouter.post(
  '/image/upload-url',
  canManageResources,
  validate({ body: resourceImageUploadSchema }),
  resourceController.createResourceImageUploadUrl,
);
resourceRouter.post('/import', canManageResources, validate({ body: importResourcesSchema }), resourceController.importResources);
resourceRouter.post(
  '/bulk-upsert',
  canManageResources,
  validate({ body: bulkUpsertResourcesSchema }),
  resourceController.bulkUpsertResources,
);
resourceRouter.post(
  '/bulk-price',
  canManageResources,
  validate({ body: bulkPriceUpdateSchema }),
  resourceController.bulkPriceUpdate,
);

resourceRouter.get('/:id', validate({ params: resourceIdParamsSchema }), resourceController.getResource);
resourceRouter.put(
  '/:id',
  canManageResources,
  validate({ params: resourceIdParamsSchema, body: updateResourceSchema }),
  resourceController.updateResource,
);
resourceRouter.delete(
  '/:id',
  canManageResources,
  validate({ params: resourceIdParamsSchema }),
  resourceController.deleteResource,
);

// Price history
resourceRouter.get('/:id/price-history', validate({ params: resourceIdParamsSchema }), resourceController.getPriceHistory);
resourceRouter.post(
  '/:id/price-history',
  canManageResources,
  validate({ params: resourceIdParamsSchema, body: createPriceHistorySchema }),
  resourceController.addPriceHistory,
);