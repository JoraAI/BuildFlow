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
import {
  adjustStockSchema,
  batchMetadataParamsSchema,
  batchMetadataUpdateSchema,
  openingStockImportSchema,
  quickVendorReceiptSchema,
} from '@buildflow/shared';

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
  '/quick-receipt',
  requirePermission('stock.manage'),
  validate({ body: quickVendorReceiptSchema }),
  inventoryStockController.receiveQuick,
);
inventoryStockRouter.post(
  '/opening-stock',
  requirePermission('stock.manage'),
  validate({ body: openingStockImportSchema }),
  inventoryStockController.importOpening,
);

// INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch / expiry read surfaces.
// Gated by the `batch_expiry` flag which ALSO asserts Kirana vertical - a
// hardware RETAIL / stationery WHOLESALE tenant (no KIRANA vertical) gets 403.
inventoryStockRouter.get(
  '/batches',
  requireInventoryFeature('batch_expiry'),
  requirePermission('stock.manage'),
  inventoryStockController.batches,
);
inventoryStockRouter.get(
  '/expiry-summary',
  requireInventoryFeature('batch_expiry'),
  requirePermission('stock.manage'),
  inventoryStockController.expiryBuckets,
);
inventoryStockRouter.patch(
  '/batches/:id',
  requireInventoryFeature('batch_expiry'),
  requirePermission('stock.manage'),
  validate({ params: batchMetadataParamsSchema, body: batchMetadataUpdateSchema }),
  inventoryStockController.updateBatch,
);
