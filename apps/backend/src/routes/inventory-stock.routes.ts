/**
 * BuildFlow - Inventory stock routes (INVENTORY_HORIZONTAL_PLATFORM Phase 1.3/1.4).
 *
 * Mounted at /api/inventory/stock - company-scoped (resolves the default STORE
 * project server-side). Gated to the INVENTORY plan via the `stock_adjustments`
 * feature flag; construction tenants get 403.
 */
import { Router } from 'express';
import * as inventoryStockController from '../controllers/inventory-stock.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { adjustStockSchema, openingStockImportSchema } from '@buildflow/shared';

export const inventoryStockRouter = Router();

inventoryStockRouter.use(authenticateToken);
inventoryStockRouter.use(requireInventoryFeature('stock_adjustments'));

inventoryStockRouter.post(
  '/adjust',
  requirePermission('stock.manage'),
  validate({ body: adjustStockSchema }),
  inventoryStockController.adjust,
);
inventoryStockRouter.post(
  '/opening-stock',
  requirePermission('stock.manage'),
  validate({ body: openingStockImportSchema }),
  inventoryStockController.importOpening,
);
